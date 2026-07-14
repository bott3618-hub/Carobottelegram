import type * as TelegramBot from "node-telegram-bot-api";
import { logger } from "../../lib/logger";
import type { WinLength } from "../constants";
import {
  getGame,
  getLobby,
  setLobby,
  clearLobby,
  getPendingModeChoice,
  setPendingModeChoice,
  clearPendingModeChoice,
  type PlayerInfo,
} from "../game/state";
import { startGame } from "../game/manager";

function displayName(from: TelegramBot.User): string {
  const name = [from.first_name, from.last_name].filter(Boolean).join(" ");
  return name || from.username || `User ${from.id}`;
}

export function mainReplyKeyboard(): TelegramBot.ReplyKeyboardMarkup {
  return {
    keyboard: [
      [{ text: "/start" }, { text: "/join" }, { text: "/joinbot" }, { text: "/win" }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

export async function sendGameIntro(
  bot: TelegramBot,
  chatId: number,
): Promise<void> {
  await bot.sendMessage(
    chatId,
    [
      "\u{1F3AE} Trò chơi bắt đầu!",
      "",
      "Gõ /join để tham gia (chọn 4 con thắng, hoặc 5 con thắng).",
      "Gõ /joinbot để tham gia với bot (mặc định đánh 5 con thẳng hàng thắng).",
    ].join("\n"),
    { reply_markup: mainReplyKeyboard() },
  );
}

export async function handleJoin(
  bot: TelegramBot,
  chatId: number,
  from: TelegramBot.User,
): Promise<void> {
  if (getGame(chatId)) {
    await bot.sendMessage(chatId, "Đang có một ván đấu diễn ra trong nhóm này rồi.");
    return;
  }

  const existingLobby = getLobby(chatId);
  const host: PlayerInfo = { id: from.id, name: displayName(from), isBot: false };

  if (!existingLobby) {
    const pendingChoice = getPendingModeChoice(chatId);
    if (pendingChoice) {
      if (pendingChoice.hostId !== from.id) {
        await bot.sendMessage(
          chatId,
          `${pendingChoice.hostName} đang chọn chế độ chơi, vui lòng đợi.`,
        );
      }
      return;
    }

    const sent = await bot.sendMessage(
      chatId,
      `${host.name} muốn tạo ván mới. Chọn chế độ chơi:`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "4 con thắng", callback_data: "mode:4" },
              { text: "5 con thắng", callback_data: "mode:5" },
            ],
          ],
        },
      },
    );
    setPendingModeChoice(chatId, {
      chatId,
      hostId: host.id,
      hostName: host.name,
      messageId: sent.message_id,
    });
    return;
  }

  if (existingLobby.host.id === from.id) {
    await bot.sendMessage(chatId, "Bạn đã tạo ván chờ rồi, hãy đợi người chơi khác /join.");
    return;
  }

  clearLobby(chatId);
  await bot.sendMessage(
    chatId,
    `Trận đấu bắt đầu: ${existingLobby.host.name} vs ${host.name}!`,
    { reply_markup: mainReplyKeyboard() },
  );
  await startGame(
    bot,
    chatId,
    existingLobby.winLength,
    existingLobby.host,
    host,
    false,
  );
}

export async function handleModeSelection(
  bot: TelegramBot,
  chatId: number,
  messageId: number,
  from: TelegramBot.User,
  winLength: WinLength,
  answerCallback: (text?: string) => Promise<void>,
): Promise<void> {
  if (getGame(chatId)) {
    await answerCallback("Đang có ván đấu diễn ra rồi.");
    return;
  }

  const existingLobby = getLobby(chatId);
  if (existingLobby) {
    await answerCallback("Đã có người tạo ván chờ, hãy /join để tham gia.");
    return;
  }

  const pendingChoice = getPendingModeChoice(chatId);
  if (!pendingChoice || pendingChoice.messageId !== messageId) {
    await answerCallback("Lựa chọn này không còn hiệu lực.");
    return;
  }

  if (pendingChoice.hostId !== from.id) {
    await answerCallback("Chỉ người tạo ván mới được chọn chế độ chơi.");
    return;
  }

  clearPendingModeChoice(chatId);

  const host: PlayerInfo = { id: from.id, name: displayName(from), isBot: false };
  setLobby(chatId, { chatId, winLength, host, createdAt: Date.now() });
  await answerCallback("Đã tạo ván chờ!");

  try {
    await bot.editMessageText(
      `${host.name} đã tạo ván chờ (${winLength} con thắng). Người khác gõ /join để vào chơi!`,
      { chat_id: chatId, message_id: messageId },
    );
  } catch (err) {
    logger.debug({ err }, "Could not edit lobby message, ignoring");
  }
}

export async function handleJoinBot(
  bot: TelegramBot,
  chatId: number,
  from: TelegramBot.User,
): Promise<void> {
  if (getGame(chatId)) {
    await bot.sendMessage(chatId, "Đang có một ván đấu diễn ra trong nhóm này rồi.");
    return;
  }

  clearLobby(chatId);

  const host: PlayerInfo = { id: from.id, name: displayName(from), isBot: false };
  const botPlayer: PlayerInfo = { id: -1, name: "Bot", isBot: true };

  await bot.sendMessage(chatId, `${host.name} thách đấu Bot (5 con thắng)!`, {
    reply_markup: mainReplyKeyboard(),
  });
  await startGame(bot, chatId, 5, host, botPlayer, true);
}
