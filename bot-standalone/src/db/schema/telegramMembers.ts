import { pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const telegramMembersTable = pgTable(
  "telegram_members",
  {
    chatId: text("chat_id").notNull(),
    userId: text("user_id").notNull(),
    firstName: text("first_name").notNull().default(""),
    lastName: text("last_name").notNull().default(""),
    username: text("username").notNull().default(""),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.chatId, table.userId] })],
);

export const insertTelegramMemberSchema = createInsertSchema(telegramMembersTable).omit({
  lastSeenAt: true,
});
export type InsertTelegramMember = z.infer<typeof insertTelegramMemberSchema>;
export type TelegramMember = typeof telegramMembersTable.$inferSelect;
