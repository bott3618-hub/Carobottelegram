import { BOARD_SIZE, type WinLength } from "../constants.js";

export type Cell = 0 | 1 | 2;

export interface GameEngine {
  board: Cell[][];
  size: number;
  winLength: WinLength;
}

export function createBoard(size: number): Cell[][] {
  return Array.from({ length: size }, () => Array<Cell>(size).fill(0));
}

export function createEngine(winLength: WinLength): GameEngine {
  return { board: createBoard(BOARD_SIZE), size: BOARD_SIZE, winLength };
}

export function isInBounds(engine: GameEngine, row: number, col: number): boolean {
  return row >= 0 && row < engine.size && col >= 0 && col < engine.size;
}

export function isCellEmpty(engine: GameEngine, row: number, col: number): boolean {
  return isInBounds(engine, row, col) && engine.board[row]![col] === 0;
}

export function placeMove(engine: GameEngine, row: number, col: number, player: Cell): void {
  engine.board[row]![col] = player;
}

export function isBoardFull(engine: GameEngine): boolean {
  return engine.board.every((row) => row.every((cell) => cell !== 0));
}

const DIRECTIONS: Array<[number, number]> = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

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
    while (isInBounds(engine, r, c) && engine.board[r]![c] === player) { count++; r += dr; c += dc; }
    r = row - dr; c = col - dc;
    while (isInBounds(engine, r, c) && engine.board[r]![c] === player) { count++; r -= dr; c -= dc; }
    if (count >= engine.winLength) return true;
  }
  return false;
}
