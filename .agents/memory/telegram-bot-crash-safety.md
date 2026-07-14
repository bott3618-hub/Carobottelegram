---
name: Telegram bot crash-safety
description: Legacy Markdown parse_mode on user-controlled text can crash the whole Node process; how to prevent it.
---

`node-telegram-bot-api` calls that use `{ parse_mode: "Markdown" }` (Telegram's
legacy Markdown, not MarkdownV2) will throw a 400 error from the Telegram API
if the message text contains an unmatched `_`, `*`, `` ` ``, or `[` — very easy
to hit accidentally when the text embeds user-controlled data such as a group
title, a member's display name, or a username.

**Why:** In this project, no global `unhandledRejection`/`uncaughtException`
handler existed, so a single failed `bot.sendMessage(...)` call (rejected
promise from a fire-and-forget `void handler(...)` call) crashed the entire
Node process — taking down the HTTP API server along with the bot, not just
that one message.

**How to apply:**
- Register `process.on("unhandledRejection", ...)` and
  `process.on("uncaughtException", ...)` at startup (log and continue) so one
  bad Telegram API call never takes the whole server down.
- Avoid `parse_mode: "Markdown"`/`"MarkdownV2"` on any string built from
  user-controlled input (names, titles, usernames) unless it is properly
  escaped for that parse mode. Prefer sending plain text (no `parse_mode`) for
  such messages instead of trying to escape every special character.

## Silent desync from editMessageText rate limits

`editMessageText` (used to update an in-place game board) can hit Telegram's
per-chat rate limit (~1 edit/sec) and return 429 "Too Many Requests" when
moves happen in quick succession. If that error is only logged and swallowed,
the server-side game state still finishes (win/timeout/draw), but the chat UI
never shows the result — the board looks frozen on "your turn" while the
game is actually already over, so the next tap says "the match already
ended" with no visible cause.

**Why:** silently catching the edit failure decoupled "game state" from
"what the user sees" — the two must stay in sync or the game looks broken
even though the logic was correct.

**How to apply:** on 429 from a Telegram edit call, retry after the
API-provided `retry_after` (a couple of attempts). If retries are exhausted
for a *final* state update (win/loss/draw/timeout), fall back to sending a
brand-new message instead of dropping the update — the outcome must always
reach the chat even if the in-place edit never lands.
