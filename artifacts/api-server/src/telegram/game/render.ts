import type * as TelegramBot from "node-telegram-bot-api";
import type { Cell, GameEngine } from "./engine";

const MARKS: Record<Cell, string> = {
  0: "\u00b7",
  1: "\u26aa",
  2: "\u26ab",
};

export function renderBoardKeyboard(
  engine: GameEngine,
): TelegramBot.InlineKeyboardButton[][] {
  const rows: TelegramBot.InlineKeyboardButton[][] = [];

  for (let row = 0; row < engine.rows; row++) {
    const cols: TelegramBot.InlineKeyboardButton[] = [];
    for (let col = 0; col < engine.cols; col++) {
      const cell = engine.board[row]![col];
      cols.push({
        text: MARKS[cell],
        callback_data: `mv:${row}:${col}`,
      });
    }
    rows.push(cols);
  }

  return rows;
}

export function playerMarkEmoji(player: Cell): string {
  return MARKS[player];
}
