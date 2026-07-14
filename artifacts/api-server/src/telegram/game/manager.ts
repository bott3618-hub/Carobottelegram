import type * as TelegramBot from "node-telegram-bot-api";
import { logger } from "../../lib/logger";
import type { WinLength } from "../constants";
import { TURN_TIMEOUT_MS } from "../constants";
import { checkWin, createEngine, isBoardFull, isCellEmpty, placeMove } from "./engine";
import { pickBotMove } from "./ai";
import { boardCaption } from "./messages";
import { renderBoardKeyboard, playerMarkEmoji } from "./render";
import { recordWin } from "../db";
import {
  clearGame,
  getGame,
  otherPlayer,
  setGame,
  type GameSession,
  type PlayerInfo,
} from "./state";

// Telegram's editMessageText enforces a per-chat rate limit (~1 edit/sec).
// Rapid moves (e.g. bot replying right after a player, or a player tapping
// quickly) can trigger a 429 "Too Many Requests" response. Retry a couple of
// times honoring `retry_after` before giving up.
const MAX_EDIT_RETRIES = 2;

function getRetryAfterSeconds(err: unknown): number | null {
  if (err && typeof err === "object" && "response" in err) {
    const response = (err as { response?: unknown }).response;
    if (response && typeof response === "object" && "body" in response) {
      const body = (response as { body?: unknown }).body;
      const retryAfter = (
        body as { parameters?: { retry_after?: unknown } } | undefined
      )?.parameters?.retry_after;
      if (typeof retryAfter === "number") return retryAfter;
    }
  }
  return null;
}

async function sendOrUpdateBoard(
  bot: TelegramBot,
  session: GameSession,
  status?: string,
): Promise<void> {
  const text = boardCaption(session, status);
  const keyboard = renderBoardKeyboard(session.engine);

  if (session.boardMessageId == null) {
    const sent = await bot.sendMessage(session.chatId, text, {
      reply_markup: { inline_keyboard: keyboard },
    });
    session.boardMessageId = sent.message_id;
    return;
  }

  for (let attempt = 0; attempt <= MAX_EDIT_RETRIES; attempt++) {
    try {
      await bot.editMessageText(text, {
        chat_id: session.chatId,
        message_id: session.boardMessageId,
        reply_markup: { inline_keyboard: keyboard },
      });
      return;
    } catch (err) {
      const retryAfterSec = getRetryAfterSeconds(err);
      if (retryAfterSec != null && attempt < MAX_EDIT_RETRIES) {
        logger.warn(
          { err, attempt, retryAfterSec },
          "Rate limited editing board message, retrying",
        );
        await new Promise((resolve) =>
          setTimeout(resolve, (retryAfterSec + 1) * 1000),
        );
        continue;
      }

      logger.warn({ err }, "Failed to edit board message");

      // The edit is permanently rejected (rate limit exhausted or some other
      // error). For a final result (`status` set — win/loss/draw/timeout)
      // this must not be silently swallowed, or the game ends server-side
      // while the chat still shows the stale "your turn" board with no
      // visible outcome. Fall back to a brand-new message in that case.
      if (status) {
        try {
          const sent = await bot.sendMessage(session.chatId, text, {
            reply_markup: { inline_keyboard: keyboard },
          });
          session.boardMessageId = sent.message_id;
        } catch (fallbackErr) {
          logger.error(
            { err: fallbackErr },
            "Failed to send fallback board message after edit failure",
          );
        }
      }
      return;
    }
  }
}

function scheduleTurnTimeout(bot: TelegramBot, session: GameSession): void {
  if (session.turnTimer) clearTimeout(session.turnTimer);

  session.turnTimer = setTimeout(() => {
    void handleTimeout(bot, session.chatId);
  }, TURN_TIMEOUT_MS);
}

export async function startGame(
  bot: TelegramBot,
  chatId: number,
  winLength: WinLength,
  playerOne: PlayerInfo,
  playerTwo: PlayerInfo,
  vsBot: boolean,
): Promise<void> {
  const session: GameSession = {
    chatId,
    engine: createEngine(winLength),
    players: { 1: playerOne, 2: playerTwo },
    currentPlayer: 1,
    boardMessageId: null,
    turnTimer: null,
    vsBot,
    finished: false,
  };

  setGame(chatId, session);
  await sendOrUpdateBoard(bot, session);
  scheduleTurnTimeout(bot, session);
}

async function finishGame(
  bot: TelegramBot,
  session: GameSession,
  status: string,
  winner?: PlayerInfo,
): Promise<void> {
  session.finished = true;
  if (session.turnTimer) clearTimeout(session.turnTimer);
  await sendOrUpdateBoard(bot, session, status);
  clearGame(session.chatId);

  // Only tally wins for real players, scoped to this chat — bot victories
  // and draws are never recorded.
  if (winner && !winner.isBot) {
    try {
      await recordWin(session.chatId, winner.id, winner.name);
    } catch (err) {
      logger.error({ err }, "Failed to record win");
    }
  }
}

async function maybePlayBotTurn(
  bot: TelegramBot,
  session: GameSession,
): Promise<void> {
  const current = session.players[session.currentPlayer];
  if (!current.isBot || session.finished) return;

  // Small delay so the move feels natural instead of instantaneous.
  await new Promise((resolve) => setTimeout(resolve, 700));

  if (session.finished) return;

  const { row, col } = pickBotMove(
    session.engine,
    session.currentPlayer,
    otherPlayer(session.currentPlayer),
  );
  await applyMove(bot, session, row, col);
}

async function applyMove(
  bot: TelegramBot,
  session: GameSession,
  row: number,
  col: number,
): Promise<void> {
  if (session.finished) return;
  if (!isCellEmpty(session.engine, row, col)) return;

  // Cancel the pending timeout immediately, before any awaits below, so a
  // move accepted right at the deadline can never race with a stale timer
  // firing and forfeiting a turn that already completed.
  if (session.turnTimer) {
    clearTimeout(session.turnTimer);
    session.turnTimer = null;
  }

  const player = session.currentPlayer;
  placeMove(session.engine, row, col, player);

  const won = checkWin(session.engine, row, col, player);
  if (won) {
    const winner = session.players[player];
    await finishGame(
      bot,
      session,
      `\u{1F3C6} ${playerMarkEmoji(player)} ${winner.name} giành chiến thắng!`,
      winner,
    );
    return;
  }

  if (isBoardFull(session.engine)) {
    await finishGame(bot, session, "\u{1F91D} Hòa! Bàn cờ đã đầy.");
    return;
  }

  session.currentPlayer = otherPlayer(player);
  await sendOrUpdateBoard(bot, session);
  scheduleTurnTimeout(bot, session);

  await maybePlayBotTurn(bot, session);
}

export async function handleMove(
  bot: TelegramBot,
  chatId: number,
  actingUserId: number,
  row: number,
  col: number,
  answerCallback: (text?: string) => Promise<void>,
): Promise<void> {
  const session = getGame(chatId);
  if (!session || session.finished) {
    await answerCallback("Ván đấu đã kết thúc.");
    return;
  }

  const current = session.players[session.currentPlayer];
  if (current.isBot || current.id !== actingUserId) {
    await answerCallback("Chưa tới lượt của bạn.");
    return;
  }

  if (!isCellEmpty(session.engine, row, col)) {
    await answerCallback("Ô này đã được đánh.");
    return;
  }

  await answerCallback();
  await applyMove(bot, session, row, col);
}

async function handleTimeout(bot: TelegramBot, chatId: number): Promise<void> {
  const session = getGame(chatId);
  if (!session || session.finished) return;

  const loser = session.players[session.currentPlayer];
  const winner = session.players[otherPlayer(session.currentPlayer)];

  await finishGame(
    bot,
    session,
    `\u23F0 ${loser.name} hết giờ suy nghĩ! ${playerMarkEmoji(
      otherPlayer(session.currentPlayer),
    )} ${winner.name} giành chiến thắng!`,
    winner,
  );
}
