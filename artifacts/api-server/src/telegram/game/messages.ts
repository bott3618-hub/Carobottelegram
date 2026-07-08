import type { GameSession, PlayerInfo } from "./state";
import { playerMarkEmoji } from "./render";

export function boardCaption(
  session: GameSession,
  status?: string,
): string {
  const p1 = session.players[1];
  const p2 = session.players[2];
  const modeLabel = `${session.engine.winLength} quan liên tiếp`;

  const lines = [
    `\u{1F3AE} Caro (${modeLabel})`,
    `${playerMarkEmoji(1)} ${p1.name}  vs  ${playerMarkEmoji(2)} ${p2.name}`,
  ];

  if (status) {
    lines.push(status);
  } else {
    const current = session.players[session.currentPlayer];
    lines.push(
      `Lượt của ${playerMarkEmoji(session.currentPlayer)} ${current.name} — có 60s để đi.`,
    );
  }

  return lines.join("\n");
}

export function playerLabel(player: PlayerInfo): string {
  return player.isBot ? player.name : `${player.name}`;
}
