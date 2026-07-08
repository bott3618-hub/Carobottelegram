import { BOARD_SIZE, type WinLength } from "../constants";

export type Cell = 0 | 1 | 2; // 0 = empty, 1 = player one, 2 = player two

export interface GameEngine {
  board: Cell[][];
  size: number;
  winLength: WinLength;
}

export function createBoard(size: number): Cell[][] {
  return Array.from({ length: size }, () =>
    Array<Cell>(size).fill(0),
  );
}

export function createEngine(winLength: WinLength): GameEngine {
  return {
    board: createBoard(BOARD_SIZE),
    size: BOARD_SIZE,
    winLength,
  };
}

export function isInBounds(engine: GameEngine, row: number, col: number): boolean {
  return row >= 0 && row < engine.size && col >= 0 && col < engine.size;
}

export function isCellEmpty(engine: GameEngine, row: number, col: number): boolean {
  return isInBounds(engine, row, col) && engine.board[row]![col] === 0;
}

export function placeMove(
  engine: GameEngine,
  row: number,
  col: number,
  player: Cell,
): void {
  engine.board[row]![col] = player;
}

export function isBoardFull(engine: GameEngine): boolean {
  return engine.board.every((row) => row.every((cell) => cell !== 0));
}

const DIRECTIONS: Array<[number, number]> = [
  [0, 1], // horizontal
  [1, 0], // vertical
  [1, 1], // diagonal down-right
  [1, -1], // diagonal down-left
];

/**
 * Checks whether placing at (row, col) completed a winning line for `player`.
 * Only checks lines that pass through the just-played cell, which is enough
 * since no other line could have won before this move.
 */
export function checkWin(
  engine: GameEngine,
  row: number,
  col: number,
  player: Cell,
): boolean {
  for (const [dr, dc] of DIRECTIONS) {
    let count = 1;

    let r = row + dr;
    let c = col + dc;
    while (isInBounds(engine, r, c) && engine.board[r]![c] === player) {
      count++;
      r += dr;
      c += dc;
    }

    r = row - dr;
    c = col - dc;
    while (isInBounds(engine, r, c) && engine.board[r]![c] === player) {
      count++;
      r -= dr;
      c -= dc;
    }

    if (count >= engine.winLength) {
      return true;
    }
  }

  return false;
}
