import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// One row per Telegram group/supergroup the bot has ever been added to.
// `allowed` gates whether the game features work in that chat -- a super
// admin must explicitly allow a chatId before /join or /joinbot work there.
export const telegramGroupsTable = pgTable("telegram_groups", {
  chatId: text("chat_id").primaryKey(),
  title: text("title").notNull().default(""),
  allowed: boolean("allowed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertTelegramGroupSchema = createInsertSchema(
  telegramGroupsTable,
).omit({ createdAt: true, updatedAt: true });
export type InsertTelegramGroup = z.infer<typeof insertTelegramGroupSchema>;
export type TelegramGroup = typeof telegramGroupsTable.$inferSelect;
