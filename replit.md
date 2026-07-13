# Caro Telegram Bot

A Telegram bot that lets people play Caro (Gomoku, 4-or-5-in-a-row) against each other or against a built-in bot, inside Telegram groups the admin has approved.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server + Telegram bot (polling)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required secret: `TELEGRAM_BOT_TOKEN` — bot token from @BotFather
- Required env: `TELEGRAM_SUPER_ADMIN_ID` — Telegram user ID with full admin control over the bot
- Optional env: `GAME_BOARD_SIZE` — board dimension (default 15; set to 10 in this project so the full board fits on one phone screen without scrolling)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/api-server/src/telegram/bot.ts` — bot bootstrap + command/event router
- `artifacts/api-server/src/telegram/game/` — Caro engine, AI opponent, board rendering, in-memory game/lobby state (per chatId)
- `artifacts/api-server/src/telegram/handlers/lobby.ts` — `/join`, `/joinbot`, mode-selection lobby
- `artifacts/api-server/src/telegram/handlers/admin.ts` — super-admin commands (allow/disallow, members, export, kick, mute, broadcast)
- `artifacts/api-server/src/telegram/handlers/tracking.ts` — group/member tracking, "bot added to group" announcement
- `lib/db/src/schema/telegramGroups.ts`, `telegramMembers.ts`, `telegramWins.ts` — group whitelist, best-effort member roster, win tallies

## Architecture decisions

- Only one super admin (fixed via `TELEGRAM_SUPER_ADMIN_ID`) can run admin commands, from anywhere (DM or group) — simpler than a role system for a single-operator bot.
- Groups must be explicitly `/allow`'d by the super admin before game commands work there; the bot announces its chat ID and a contact handle when added to a new group.
- Game/lobby state lives in memory, keyed by chatId — never persisted, since a restart mid-game is an acceptable loss and this keeps groups fully isolated from each other.
- Member rosters are best-effort: Telegram's Bot API has no "list all members" endpoint, so the bot records users only as it observes them (messages, joins/leaves).
- The board renders as an inline-keyboard grid (tap-to-place) rather than typed coordinates, edited in place each turn.

## Product

- `/join` — create or join a PvP lobby; the host picks 4-in-a-row or 5-in-a-row before the match starts.
- `/joinbot` — play against the built-in AI (always 5-in-a-row).
- 60-second per-turn countdown; timing out forfeits the game to the opponent.
- Admin: approve/revoke groups, list groups, view/export member rosters (name + @username), kick/mute/unmute members, broadcast messages to one or all approved groups.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Pin `node-telegram-bot-api` to `0.66.0` (with `@types/node-telegram-bot-api@0.64.15`). The `1.x` line is a full rewrite with a different API shape and breaks this codebase.
- `restrictChatMember` permissions must be passed under a `permissions: {...}` key with granular fields (`can_send_audios`, `can_send_photos`, etc.) — the older `can_send_media_messages` flag doesn't exist in the installed types.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
