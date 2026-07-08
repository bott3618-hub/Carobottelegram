import { and, desc, eq, sql } from "drizzle-orm";
import {
  db,
  telegramGroupsTable,
  telegramMembersTable,
  telegramWinsTable,
  type TelegramGroup,
  type TelegramWin,
} from "@workspace/db";

export async function upsertGroup(
  chatId: number,
  title: string,
): Promise<TelegramGroup> {
  const chatIdStr = String(chatId);
  const [existing] = await db
    .select()
    .from(telegramGroupsTable)
    .where(eq(telegramGroupsTable.chatId, chatIdStr));

  if (existing) {
    if (title && existing.title !== title) {
      const [updated] = await db
        .update(telegramGroupsTable)
        .set({ title })
        .where(eq(telegramGroupsTable.chatId, chatIdStr))
        .returning();
      return updated!;
    }
    return existing;
  }

  const [created] = await db
    .insert(telegramGroupsTable)
    .values({ chatId: chatIdStr, title, allowed: false })
    .returning();
  return created!;
}

export async function isGroupAllowed(chatId: number): Promise<boolean> {
  const [row] = await db
    .select()
    .from(telegramGroupsTable)
    .where(eq(telegramGroupsTable.chatId, String(chatId)));
  return row?.allowed ?? false;
}

export async function setGroupAllowed(
  chatId: string,
  allowed: boolean,
): Promise<TelegramGroup | undefined> {
  const [row] = await db
    .update(telegramGroupsTable)
    .set({ allowed })
    .where(eq(telegramGroupsTable.chatId, chatId))
    .returning();
  return row;
}

export async function listGroups(): Promise<TelegramGroup[]> {
  return db
    .select()
    .from(telegramGroupsTable)
    .orderBy(desc(telegramGroupsTable.updatedAt));
}

export async function trackMember(
  chatId: number,
  userId: number,
  firstName: string,
  lastName: string,
  username: string,
): Promise<void> {
  const chatIdStr = String(chatId);
  const userIdStr = String(userId);

  const [existing] = await db
    .select()
    .from(telegramMembersTable)
    .where(
      and(
        eq(telegramMembersTable.chatId, chatIdStr),
        eq(telegramMembersTable.userId, userIdStr),
      ),
    );

  if (existing) {
    await db
      .update(telegramMembersTable)
      .set({
        firstName,
        lastName,
        username,
        lastSeenAt: new Date(),
      })
      .where(
        and(
          eq(telegramMembersTable.chatId, chatIdStr),
          eq(telegramMembersTable.userId, userIdStr),
        ),
      );
    return;
  }

  await db.insert(telegramMembersTable).values({
    chatId: chatIdStr,
    userId: userIdStr,
    firstName,
    lastName,
    username,
  });
}

export async function removeMember(
  chatId: string,
  userId: string,
): Promise<void> {
  await db
    .delete(telegramMembersTable)
    .where(
      and(
        eq(telegramMembersTable.chatId, chatId),
        eq(telegramMembersTable.userId, userId),
      ),
    );
}

export async function listMembers(chatId: string) {
  return db
    .select()
    .from(telegramMembersTable)
    .where(eq(telegramMembersTable.chatId, chatId))
    .orderBy(desc(telegramMembersTable.lastSeenAt));
}

export async function recordWin(
  chatId: number,
  userId: number,
  playerName: string,
): Promise<void> {
  const chatIdStr = String(chatId);
  const userIdStr = String(userId);

  await db
    .insert(telegramWinsTable)
    .values({ chatId: chatIdStr, userId: userIdStr, playerName, wins: 1 })
    .onConflictDoUpdate({
      target: [telegramWinsTable.chatId, telegramWinsTable.userId],
      set: {
        playerName,
        wins: sql`${telegramWinsTable.wins} + 1`,
      },
    });
}

export async function listWins(chatId: number): Promise<TelegramWin[]> {
  return db
    .select()
    .from(telegramWinsTable)
    .where(eq(telegramWinsTable.chatId, String(chatId)))
    .orderBy(desc(telegramWinsTable.wins));
}
