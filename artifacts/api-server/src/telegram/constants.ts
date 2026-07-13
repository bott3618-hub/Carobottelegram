export const BOARD_SIZE = Number(process.env["GAME_BOARD_SIZE"] ?? 15);

// The single super admin who can manage groups, members, and broadcasts.
// Set as a plain (non-secret) env var since it's just a numeric Telegram user id.
export const SUPER_ADMIN_ID = process.env["TELEGRAM_SUPER_ADMIN_ID"] ?? "";

export const TURN_TIMEOUT_MS = 60_000;

export const CONTACT_ADMIN_USERNAME = "@vt1838";

export type WinLength = 4 | 5;
