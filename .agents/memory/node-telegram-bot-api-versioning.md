---
name: node-telegram-bot-api versioning
description: Why node-telegram-bot-api must be pinned to 0.66.0 in this monorepo, not the 1.x line.
---

`node-telegram-bot-api@1.x` is a ground-up rewrite: it drops the classic default-export-class-with-namespace-merge type shape in favor of named type exports from `./types/index.js`, and its runtime/constructor surface differs from the `0.6x` line that almost all existing tutorials, `@types/node-telegram-bot-api`, and StackOverflow snippets assume.

**Why:** Installing `node-telegram-bot-api@1.1.2` alongside `@types/node-telegram-bot-api@0.64.15` (the classic community types) caused `TS2702 'TelegramBot' only refers to a type, but is being used as a namespace here` across every file doing `TelegramBot.Message`/`TelegramBot.User`-style type access, because the two packages disagree on whether `TelegramBot` is a namespace-merged value or a plain type.

**How to apply:** When adding a Telegram bot to this workspace, install `node-telegram-bot-api@0.66.0` with `@types/node-telegram-bot-api@0.64.15` (not the latest 1.x). Use `import type * as TelegramBot from "node-telegram-bot-api"` (not `import type TelegramBot from ...`) in files that only need types, since `isolatedModules`/`verbatimModuleSyntax` rejects namespace-style access on a type-only default import. Also note `restrictChatMember` permissions must be nested under a `permissions: {...}` key with granular flags (`can_send_audios`, `can_send_photos`, etc.) in this types version — there is no `can_send_media_messages` shortcut.
