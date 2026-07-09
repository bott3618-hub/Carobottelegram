import type { Cell, GameEngine } from "./engine.js";
import type { WinLength } from "../constants.js";

export interface PlayerInfo {
  id: number;
  name: string;
  isBot: boolean;
}

export interface GameSession {
  chatId: number;
  engine: GameEngine;
  players: Record<1 | 2, PlayerInfo>;
  currentPlayer: 1 | 2;
  boardMessageId: number | null;
  turnTimer: NodeJS.Timeout | null;
  vsBot: boolean;
  finished: boolean;
}

export interface PendingLobby {
  chatId: number;
  winLength: WinLength;
  host: PlayerInfo;
  createdAt: number;
}

export interface PendingModeChoice {
  chatId: number;
  hostId: number;
  hostName: string;
  messageId: number;
}

const games = new Map<number, GameSession>();
const lobbies = new Map<number, PendingLobby>();
const pendingModeChoices = new Map<number, PendingModeChoice>();

export function getPendingModeChoice(chatId: number): PendingModeChoice | undefined {
  return pendingModeChoices.get(chatId);
}
export function setPendingModeChoice(chatId: number, choice: PendingModeChoice): void {
  pendingModeChoices.set(chatId, choice);
}
export function clearPendingModeChoice(chatId: number): void {
  pendingModeChoices.delete(chatId);
}
export function getGame(chatId: number): GameSession | undefined {
  return games.get(chatId);
}
export function setGame(chatId: number, session: GameSession): void {
  games.set(chatId, session);
}
export function clearGame(chatId: number): void {
  const existing = games.get(chatId);
  if (existing?.turnTimer) clearTimeout(existing.turnTimer);
  games.delete(chatId);
}
export function getLobby(chatId: number): PendingLobby | undefined {
  return lobbies.get(chatId);
}
export function setLobby(chatId: number, lobby: PendingLobby): void {
  lobbies.set(chatId, lobby);
}
export function clearLobby(chatId: number): void {
  lobbies.delete(chatId);
}
export function otherPlayer(player: 1 | 2): 1 | 2 {
  return player === 1 ? 2 : 1;
}
export type { Cell };
