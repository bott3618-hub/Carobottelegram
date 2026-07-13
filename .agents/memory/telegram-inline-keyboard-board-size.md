---
name: Telegram inline keyboard board-size limits
description: Why large game boards rendered as Telegram inline keyboards appear cropped/scrolled, making bot wins look invalid.
---

Telegram enforces a minimum touch width per inline keyboard button (~48px on
mobile clients). It does not shrink buttons below this to fit more columns
on screen — instead, rows wider than the screen overflow horizontally and
require the user to swipe/scroll the message sideways to see the rest.

**Why:** For a Caro/Gomoku bot rendering an NxN board as one inline keyboard,
this means any `N` much above ~7-8 causes hidden columns off-screen to the
right, and tall boards (many rows) can also require vertical scroll of the
chat. A screenshot that looks like it has no winning line can simply be
missing the columns/rows where the line actually is — the win-detection
logic can be completely correct while the rendered screenshot looks wrong.

**How to apply:** When a user reports "the bot declared a win but I don't
see 5 in a row," first check whether the board size exceeds what fits on
one screen without scrolling, before assuming a scoring/logic bug. For a
board meant to be fully visible without any scrolling on typical phones,
keep the grid to roughly 8x8 or smaller given Telegram's minimum button
width.
