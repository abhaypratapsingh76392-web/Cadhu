import { NextResponse } from "next/server";
import { db } from "@/db";
import { providers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { deleteFromFirebase } from "@/lib/firebase";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const rows = await db.select().from(providers).where(and(eq(providers.id, id), eq(providers.userId, user.id))).limit(1);
  if (!rows.length) return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  await db.delete(providers).where(eq(providers.id, id));
  deleteFromFirebase("providers", id);
  return NextResponse.json({ ok: true });
}
