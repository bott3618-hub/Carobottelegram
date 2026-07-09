import type * as TelegramBot from "node-telegram-bot-api";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { logger } from "../../lib/logger.js";
import { SUPER_ADMIN_ID } from "../constants.js";
import { listGroups, listMembers, removeMember, setGroupAllowed } from "../db.js";

export function isSuperAdmin(userId: number): boolean {
  return SUPER_ADMIN_ID !== "" && String(userId) === SUPER_ADMIN_ID;
}

function requireAdmin(bot: TelegramBot, chatId: number, userId: number): boolean {
  if (isSuperAdmin(userId)) return true;
  void bot.sendMessage(chatId, "Bạn không có quyền dùng lệnh này.");
  return false;
}

function memberDisplayName(m: { firstName: string; lastName: string }): string {
  return [m.firstName, m.lastName].filter(Boolean).join(" ") || "(không tên)";
}

export async function cmdListGroups(bot: TelegramBot, chatId: number, userId: number): Promise<void> {
  if (!requireAdmin(bot, chatId, userId)) return;
  const groups = await listGroups();
  if (groups.length === 0) { await bot.sendMessage(chatId, "Bot chưa được thêm vào nhóm nào."); return; }
  const lines = groups.map((g) => `${g.allowed ? "✅" : "❌"} \`${g.chatId}\` — ${g.title || "(chưa rõ tên)"}`);
  await bot.sendMessage(chatId, lines.join("\n"), { parse_mode: "Markdown" });
}

export async function cmdSetAllowed(bot: TelegramBot, chatId: number, userId: number, targetChatId: string, allowed: boolean): Promise<void> {
  if (!requireAdmin(bot, chatId, userId)) return;
  const updated = await setGroupAllowed(targetChatId, allowed);
  if (!updated) { await bot.sendMessage(chatId, `Không tìm thấy nhóm với ID ${targetChatId}. Bot phải được thêm vào nhóm trước.`); return; }
  await bot.sendMessage(chatId, allowed ? `Đã kích hoạt bot cho nhóm ${targetChatId}.` : `Đã tắt bot ở nhóm ${targetChatId}.`);
  if (allowed) {
    try { await bot.sendMessage(Number(targetChatId), "✅ Nhóm này đã được admin kích hoạt! Gõ /join hoặc /joinbot để bắt đầu chơi."); }
    catch (err) { logger.warn({ err }, "Could not notify group about activation"); }
  }
}

export async function cmdMembers(bot: TelegramBot, chatId: number, userId: number, targetChatId: string): Promise<void> {
  if (!requireAdmin(bot, chatId, userId)) return;
  const members = await listMembers(targetChatId);
  if (members.length === 0) { await bot.sendMessage(chatId, "Chưa ghi nhận thành viên nào trong nhóm này."); return; }
  const lines = members.map((m) => `\`${m.userId}\` — ${memberDisplayName(m)}${m.username ? ` (@${m.username})` : ""}`);
  await bot.sendMessage(chatId, lines.join("\n"), { parse_mode: "Markdown" });
}

export async function cmdExportMembers(bot: TelegramBot, chatId: number, userId: number, targetChatId: string): Promise<void> {
  if (!requireAdmin(bot, chatId, userId)) return;
  const members = await listMembers(targetChatId);
  if (members.length === 0) { await bot.sendMessage(chatId, "Chưa ghi nhận thành viên nào trong nhóm này."); return; }
  const content = [`Danh sách thành viên nhóm ${targetChatId}`, "Tên\tUsername\tUserID", ...members.map((m) => `${memberDisplayName(m)}\t${m.username ? `@${m.username}` : "-"}\t${m.userId}`)].join("\n");
  const tmpFile = path.join(os.tmpdir(), `telegram-members-${targetChatId}-${Date.now()}.txt`);
  try {
    await fs.writeFile(tmpFile, content, "utf-8");
    await bot.sendDocument(chatId, tmpFile, { caption: `Danh sách thành viên nhóm ${targetChatId} (${members.length} người)` });
  } finally {
    await fs.rm(tmpFile, { force: true });
  }
}

export async function cmdKick(bot: TelegramBot, chatId: number, userId: number, targetChatId: string, targetUserId: string): Promise<void> {
  if (!requireAdmin(bot, chatId, userId)) return;
  try {
    await bot.banChatMember(targetChatId, Number(targetUserId));
    await bot.unbanChatMember(targetChatId, Number(targetUserId), { only_if_banned: true });
    await removeMember(targetChatId, targetUserId);
    await bot.sendMessage(chatId, `Đã xoá thành viên ${targetUserId} khỏi nhóm ${targetChatId}.`);
  } catch (err) {
    logger.error({ err }, "Failed to kick member");
    await bot.sendMessage(chatId, "Không thể xoá thành viên. Kiểm tra bot đã là quản trị viên của nhóm đó chưa.");
  }
}

export async function cmdMute(bot: TelegramBot, chatId: number, userId: number, targetChatId: string, targetUserId: string, minutes: number | undefined): Promise<void> {
  if (!requireAdmin(bot, chatId, userId)) return;
  const untilDate = minutes && minutes > 0 ? Math.floor(Date.now() / 1000) + minutes * 60 : undefined;
  try {
    await bot.restrictChatMember(targetChatId, Number(targetUserId), {
      permissions: { can_send_messages: false, can_send_audios: false, can_send_documents: false, can_send_photos: false, can_send_videos: false, can_send_video_notes: false, can_send_voice_notes: false, can_send_polls: false, can_send_other_messages: false, can_add_web_page_previews: false },
      ...(untilDate ? { until_date: untilDate } : {}),
    });
    await bot.sendMessage(chatId, `Đã cấm chat thành viên ${targetUserId} trong nhóm ${targetChatId}${minutes ? ` trong ${minutes} phút` : " (vĩnh viễn)"}.`);
  } catch (err) {
    logger.error({ err }, "Failed to mute member");
    await bot.sendMessage(chatId, "Không thể cấm chat thành viên. Kiểm tra bot đã là quản trị viên của nhóm đó chưa.");
  }
}

export async function cmdUnmute(bot: TelegramBot, chatId: number, userId: number, targetChatId: string, targetUserId: string): Promise<void> {
  if (!requireAdmin(bot, chatId, userId)) return;
  try {
    await bot.restrictChatMember(targetChatId, Number(targetUserId), {
      permissions: { can_send_messages: true, can_send_audios: true, can_send_documents: true, can_send_photos: true, can_send_videos: true, can_send_video_notes: true, can_send_voice_notes: true, can_send_polls: true, can_send_other_messages: true, can_add_web_page_previews: true },
    });
    await bot.sendMessage(chatId, `Đã bỏ cấm chat cho thành viên ${targetUserId} trong nhóm ${targetChatId}.`);
  } catch (err) {
    logger.error({ err }, "Failed to unmute member");
    await bot.sendMessage(chatId, "Không thể bỏ cấm chat thành viên.");
  }
}

export async function cmdBroadcast(bot: TelegramBot, chatId: number, userId: number, targetChatId: string | null, text: string): Promise<void> {
  if (!requireAdmin(bot, chatId, userId)) return;
  const targets = targetChatId ? [targetChatId] : (await listGroups()).filter((g) => g.allowed).map((g) => g.chatId);
  let sent = 0;
  for (const target of targets) {
    try { await bot.sendMessage(Number(target), `📢 ${text}`); sent++; }
    catch (err) { logger.warn({ err, target }, "Failed to send broadcast to group"); }
  }
  await bot.sendMessage(chatId, `Đã gửi thông báo tới ${sent}/${targets.length} nhóm.`);
}
