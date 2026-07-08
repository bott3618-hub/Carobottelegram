import TelegramBot from "node-telegram-bot-api";
import { logger } from "../lib/logger";
import { isGroupAllowed, upsertGroup } from "./db";
import { sendGameIntro, handleJoin, handleJoinBot, handleModeSelection } from "./handlers/lobby";
import {
  handleLeftMember,
  handleMyChatMember,
  handleNewMembers,
  trackIncomingMessage,
} from "./handlers/tracking";
import {
  cmdBroadcast,
  cmdExportMembers,
  cmdKick,
  cmdListGroups,
  cmdMembers,
  cmdMute,
  cmdSetAllowed,
  cmdUnmute,
  isSuperAdmin,
} from "./handlers/admin";
import { handleMove } from "./game/manager";
import { BOARD_SIZE } from "./constants";

let bot: TelegramBot | null = null;

function isGroupChatType(type: string): boolean {
  return type === "group" || type === "supergroup";
}

function splitArgs(text: string): string[] {
  return text.trim().split(/\s+/).slice(1);
}

export function startTelegramBot(): void {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) {
    logger.warn("TELEGRAM_BOT_TOKEN not set — Telegram bot will not start.");
    return;
  }

  bot = new TelegramBot(token, { polling: true });
  logger.info("Telegram bot started (polling)");

  bot.on("polling_error", (err) => {
    logger.error({ err }, "Telegram polling error");
  });

  bot.on("my_chat_member", (update) => {
    void handleMyChatMember(bot!, update);
  });

  bot.on("callback_query", (query) => {
    void onCallbackQuery(query);
  });

  bot.on("message", (msg) => {
    void onMessage(msg);
  });
}

async function answerCallback(
  query: TelegramBot.CallbackQuery,
  text?: string,
): Promise<void> {
  await bot!.answerCallbackQuery(query.id, text ? { text } : {});
}

async function onCallbackQuery(query: TelegramBot.CallbackQuery): Promise<void> {
  if (!bot || !query.message || !query.data) return;
  const chatId = query.message.chat.id;

  if (query.data.startsWith("mode:")) {
    const raw = query.data.split(":")[1];
    if (raw !== "4" && raw !== "5") {
      await answerCallback(query, "Chế độ không hợp lệ.");
      return;
    }
    const winLength = Number(raw) as 4 | 5;
    await handleModeSelection(
      bot,
      chatId,
      query.message.message_id,
      query.from,
      winLength,
      (t) => answerCallback(query, t),
    );
    return;
  }

  if (query.data.startsWith("mv:")) {
    const [, rowStr, colStr] = query.data.split(":");
    const row = Number(rowStr);
    const col = Number(colStr);
    if (
      !Number.isInteger(row) ||
      !Number.isInteger(col) ||
      row < 0 ||
      col < 0 ||
      row >= BOARD_SIZE ||
      col >= BOARD_SIZE
    ) {
      await answerCallback(query, "Nước đi không hợp lệ.");
      return;
    }
    await handleMove(
      bot,
      chatId,
      query.from.id,
      row,
      col,
      (t) => answerCallback(query, t),
    );
    return;
  }
}

async function onMessage(msg: TelegramBot.Message): Promise<void> {
  if (!bot) return;

  if (msg.new_chat_members) {
    await handleNewMembers(msg);
  }
  if (msg.left_chat_member) {
    await handleLeftMember(msg);
  }

  if (!msg.text) return;

  await trackIncomingMessage(msg);

  const chatId = msg.chat.id;
  const isGroup = isGroupChatType(msg.chat.type);
  const [rawCommand, ...rest] = msg.text.trim().split(/\s+/);
  // In groups Telegram often sends commands as "/join@BotUsername" (e.g. when
  // multiple bots are present); strip the "@..." suffix so command matching
  // below still works regardless of how the client sent it.
  const command = rawCommand?.split("@")[0];
  const args = rest;

  // Admin commands work from anywhere (DM or group) — gated by user id, not chat.
  switch (command) {
    case "/allow": {
      const target = args[0];
      if (!target || !msg.from) {
        await bot.sendMessage(chatId, "Cú pháp: /allow <chat_id>");
        return;
      }
      await cmdSetAllowed(bot, chatId, msg.from.id, target, true);
      return;
    }
    case "/disallow": {
      const target = args[0];
      if (!target || !msg.from) {
        await bot.sendMessage(chatId, "Cú pháp: /disallow <chat_id>");
        return;
      }
      await cmdSetAllowed(bot, chatId, msg.from.id, target, false);
      return;
    }
    case "/listgroups": {
      if (!msg.from) return;
      await cmdListGroups(bot, chatId, msg.from.id);
      return;
    }
    case "/members": {
      const target = args[0];
      if (!target || !msg.from) {
        await bot.sendMessage(chatId, "Cú pháp: /members <chat_id>");
        return;
      }
      await cmdMembers(bot, chatId, msg.from.id, target);
      return;
    }
    case "/export": {
      const target = args[0];
      if (!target || !msg.from) {
        await bot.sendMessage(chatId, "Cú pháp: /export <chat_id>");
        return;
      }
      await cmdExportMembers(bot, chatId, msg.from.id, target);
      return;
    }
    case "/kick": {
      const [target, targetUser] = args;
      if (!target || !targetUser || !msg.from) {
        await bot.sendMessage(chatId, "Cú pháp: /kick <chat_id> <user_id>");
        return;
      }
      await cmdKick(bot, chatId, msg.from.id, target, targetUser);
      return;
    }
    case "/mute": {
      const [target, targetUser, minutesStr] = args;
      if (!target || !targetUser || !msg.from) {
        await bot.sendMessage(chatId, "Cú pháp: /mute <chat_id> <user_id> [phút]");
        return;
      }
      await cmdMute(
        bot,
        chatId,
        msg.from.id,
        target,
        targetUser,
        minutesStr ? Number(minutesStr) : undefined,
      );
      return;
    }
    case "/unmute": {
      const [target, targetUser] = args;
      if (!target || !targetUser || !msg.from) {
        await bot.sendMessage(chatId, "Cú pháp: /unmute <chat_id> <user_id>");
        return;
      }
      await cmdUnmute(bot, chatId, msg.from.id, target, targetUser);
      return;
    }
    case "/broadcast": {
      // /broadcast <chat_id> <message>  -- one group
      const [target, ...messageParts] = args;
      if (!target || messageParts.length === 0 || !msg.from) {
        await bot.sendMessage(chatId, "Cú pháp: /broadcast <chat_id> <nội dung>");
        return;
      }
      await cmdBroadcast(bot, chatId, msg.from.id, target, messageParts.join(" "));
      return;
    }
    case "/broadcastall": {
      const message = args.join(" ");
      if (!message || !msg.from) {
        await bot.sendMessage(chatId, "Cú pháp: /broadcastall <nội dung>");
        return;
      }
      await cmdBroadcast(bot, chatId, msg.from.id, null, message);
      return;
    }
    default:
      break;
  }

  if (!isGroup) {
    if (command === "/start" && msg.from && isSuperAdmin(msg.from.id)) {
      await bot.sendMessage(
        chatId,
        [
          "Xin chào Admin! Các lệnh quản trị:",
          "/allow <chat_id> — kích hoạt bot cho nhóm",
          "/disallow <chat_id> — tắt bot ở nhóm",
          "/listgroups — xem danh sách nhóm và trạng thái",
          "/members <chat_id> — xem thành viên nhóm",
          "/export <chat_id> — xuất file danh sách thành viên",
          "/kick <chat_id> <user_id> — xoá thành viên khỏi nhóm",
          "/mute <chat_id> <user_id> [phút] — cấm chat thành viên",
          "/unmute <chat_id> <user_id> — bỏ cấm chat",
          "/broadcast <chat_id> <nội dung> — gửi thông báo tới 1 nhóm",
          "/broadcastall <nội dung> — gửi thông báo tới tất cả nhóm đã kích hoạt",
        ].join("\n"),
      );
    }
    return;
  }

  // Group-only game commands, gated by whitelist.
  await upsertGroup(chatId, msg.chat.title ?? "");
  const allowed = await isGroupAllowed(chatId);

  if (!allowed) {
    if (command === "/join" || command === "/joinbot" || command === "/start") {
      await bot.sendMessage(
        chatId,
        `Nhóm này chưa được kích hoạt. Vui lòng liên hệ admin @vt1838 và gửi ID nhóm: \`${chatId}\``,
        { parse_mode: "Markdown" },
      );
    }
    return;
  }

  switch (command) {
    case "/start":
      await sendGameIntro(bot, chatId);
      break;
    case "/join":
      if (msg.from) await handleJoin(bot, chatId, msg.from);
      break;
    case "/joinbot":
      if (msg.from) await handleJoinBot(bot, chatId, msg.from);
      break;
    default:
      break;
  }
}
