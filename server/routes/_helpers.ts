import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { dogs } from "@shared/schema";

export async function dogOwnedBy(userId: number, dogId: number): Promise<boolean> {
  const rows = await db.select({ id: dogs.id }).from(dogs).where(and(eq(dogs.id, dogId), eq(dogs.userId, userId)));
  return rows.length > 0;
}
