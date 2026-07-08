import {
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Win tally per (chat, user). Counts are scoped to a single chat so stats
// never leak between groups; only human players are tracked, never the bot.
export const telegramWinsTable = pgTable(
  "telegram_wins",
  {
    chatId: text("chat_id").notNull(),
    userId: text("user_id").notNull(),
    playerName: text("player_name").notNull().default(""),
    wins: integer("wins").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [primaryKey({ columns: [table.chatId, table.userId] })],
);

export const insertTelegramWinSchema = createInsertSchema(
  telegramWinsTable,
).omit({ updatedAt: true });
export type InsertTelegramWin = z.infer<typeof insertTelegramWinSchema>;
export type TelegramWin = typeof telegramWinsTable.$inferSelect;
