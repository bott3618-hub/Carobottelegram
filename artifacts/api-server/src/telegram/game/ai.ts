import type { Cell, GameEngine } from "./engine";
import { isInBounds } from "./engine";

const SEARCH_RADIUS = 2;

interface Candidate {
  row: number;
  col: number;
}

function collectCandidates(engine: GameEngine): Candidate[] {
  const candidates = new Set<string>();
  let hasAnyPiece = false;

  for (let row = 0; row < engine.rows; row++) {
    for (let col = 0; col < engine.cols; col++) {
      if (engine.board[row]![col] === 0) continue;
      hasAnyPiece = true;

      for (let dr = -SEARCH_RADIUS; dr <= SEARCH_RADIUS; dr++) {
        for (let dc = -SEARCH_RADIUS; dc <= SEARCH_RADIUS; dc++) {
          const r = row + dr;
          const c = col + dc;
          if (!isInBounds(engine, r, c)) continue;
          if (engine.board[r]![c] !== 0) continue;
          candidates.add(`${r}:${c}`);
        }
      }
    }
  }

  if (!hasAnyPiece) {
    const midRow = Math.floor(engine.rows / 2);
    const midCol = Math.floor(engine.cols / 2);
    return [{ row: midRow, col: midCol }];
  }

  return [...candidates].map((key) => {
    const [row, col] = key.split(":").map(Number);
    return { row: row!, col: col! };
  });
}

const DIRECTIONS: Array<[number, number]> = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

/**
 * Scores how good placing `player` at (row, col) would be, by looking at the
 * longest run created in each direction and whether the ends are open.
 * Open-ended runs score much higher since they can't be blocked from one side.
 */
function scoreCell(
  engine: GameEngine,
  row: number,
  col: number,
  player: Cell,
): number {
  let total = 0;

  for (const [dr, dc] of DIRECTIONS) {
    let count = 1;
    let openEnds = 0;

    let r = row + dr;
    let c = col + dc;
    while (isInBounds(engine, r, c) && engine.board[r]![c] === player) {
      count++;
      r += dr;
      c += dc;
    }
    if (isInBounds(engine, r, c) && engine.board[r]![c] === 0) openEnds++;

    r = row - dr;
    c = col - dc;
    while (isInBounds(engine, r, c) && engine.board[r]![c] === player) {
      count++;
      r -= dr;
      c -= dc;
    }
    if (isInBounds(engine, r, c) && engine.board[r]![c] === 0) openEnds++;

    if (count >= engine.winLength) {
      total += 1_000_000;
    } else if (count === engine.winLength - 1 && openEnds > 0) {
      total += openEnds === 2 ? 50_000 : 8_000;
    } else if (count === engine.winLength - 2 && openEnds === 2) {
      total += 1_500;
    } else {
      total += count * count * (openEnds + 1) * 10;
    }
  }

  return total;
}

/**
 * Picks the bot's next move. Balances offense (its own best line) against
 * defense (blocking the opponent's best line), slightly favoring offense.
 */
export function pickBotMove(
  engine: GameEngine,
  botPlayer: Cell,
  humanPlayer: Cell,
): Candidate {
  const candidates = collectCandidates(engine);

  let best: Candidate = candidates[0]!;
  let bestScore = -Infinity;

  for (const { row, col } of candidates) {
    const offense = scoreCell(engine, row, col, botPlayer);
    const defense = scoreCell(engine, row, col, humanPlayer);
    const score = offense * 1.05 + defense;

    if (score > bestScore) {
      bestScore = score;
      best = { row, col };
    }
  }

  return best;
}
