import type * as TelegramBot from "node-telegram-bot-api";
import { logger } from "../../lib/logger";
import { removeMember, trackMember, upsertGroup } from "../db";
import { CONTACT_ADMIN_USERNAME } from "../constants";
import { sendGameIntro } from "./lobby";

function isGroupChat(chat: TelegramBot.Chat): boolean {
  return chat.type === "group" || chat.type === "supergroup";
}

export async function trackIncomingMessage(msg: TelegramBot.Message): Promise<void> {
  if (!isGroupChat(msg.chat)) return;

  try {
    await upsertGroup(msg.chat.id, msg.chat.title ?? "");
    if (msg.from) {
      await trackMember(
        msg.chat.id,
        msg.from.id,
        msg.from.first_name ?? "",
        msg.from.last_name ?? "",
        msg.from.username ?? "",
      );
    }
  } catch (err) {
    logger.error({ err }, "Failed to track incoming message");
  }
}

export async function handleMyChatMember(
  bot: TelegramBot,
  update: TelegramBot.ChatMemberUpdated,
): Promise<void> {
  if (!isGroupChat(update.chat)) return;

  const newStatus = update.new_chat_member.status;
  const becameMember = newStatus === "member" || newStatus === "administrator";

  if (!becameMember) return;

  try {
    const group = await upsertGroup(update.chat.id, update.chat.title ?? "");

    await bot.sendMessage(
      update.chat.id,
      [
        "Xin chào! Đây là ID của nhóm này:",
        `${update.chat.id}`,
        "",
        group.allowed
          ? "Nhóm này đã được kích hoạt, có thể chơi ngay!"
          : `Nhóm chưa được kích hoạt. Vui lòng liên hệ admin ${CONTACT_ADMIN_USERNAME} để mở quyền sử dụng bot cho nhóm này.`,
      ].join("\n"),
    );

    if (group.allowed) {
      await sendGameIntro(bot, update.chat.id);
    }
  } catch (err) {
    logger.error({ err }, "Failed to handle bot added to group");
  }
}

export async function handleLeftMember(
  msg: TelegramBot.Message,
): Promise<void> {
  const left = msg.left_chat_member;
  if (!left || !isGroupChat(msg.chat)) return;

  try {
    await removeMember(String(msg.chat.id), String(left.id));
  } catch (err) {
    logger.error({ err }, "Failed to remove member on leave");
  }
}

export async function handleNewMembers(msg: TelegramBot.Message): Promise<void> {
  if (!msg.new_chat_members || !isGroupChat(msg.chat)) return;

  try {
    await upsertGroup(msg.chat.id, msg.chat.title ?? "");
    for (const member of msg.new_chat_members) {
      if (member.is_bot) continue;
      await trackMember(
        msg.chat.id,
        member.id,
        member.first_name ?? "",
        member.last_name ?? "",
        member.username ?? "",
      );
    }
  } catch (err) {
    logger.error({ err }, "Failed to track new members");
  }
}
