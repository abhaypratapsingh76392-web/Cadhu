import { NextResponse } from "next/server";
import { db } from "@/db";
import { supportChats, supportMessages } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { sanitize } from "@/lib/utils";
import { syncChat, syncMessage } from "@/lib/firebase";

async function getOrCreateChat(userId: string) {
  const rows = await db.select().from(supportChats).where(eq(supportChats.userId, userId)).limit(1);
  if (rows[0]) return rows[0];
  const inserted = await db.insert(supportChats).values({ userId }).returning();
  return inserted[0];
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const chat = await getOrCreateChat(user.id);
  const msgs = await db.select().from(supportMessages).where(eq(supportMessages.chatId, chat.id)).orderBy(asc(supportMessages.createdAt));
  await db.update(supportChats).set({ unreadByUser: 0 }).where(eq(supportChats.id, chat.id));
  return NextResponse.json({ chat, messages: msgs });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const text = sanitize(String(body.body || ""), 2000);
    const imageBase64 = typeof body.imageBase64 === "string" && body.imageBase64.startsWith("data:image") ? body.imageBase64.slice(0, 400000) : null;
    if (!text && !imageBase64) return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });
    const chat = await getOrCreateChat(user.id);
    const inserted = await db
      .insert(supportMessages)
      .values({ chatId: chat.id, senderRole: "user", senderId: user.id, body: text || "[image]", imageBase64 })
      .returning();
    await db
      .update(supportChats)
      .set({ lastMessage: text || "Image", unreadByAdmin: chat.unreadByAdmin + 1, updatedAt: new Date() })
      .where(eq(supportChats.id, chat.id));
    void syncMessage(inserted[0].id);
    void syncChat(chat.id);
    return NextResponse.json({ ok: true, message: inserted[0] });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Could not send message" }, { status: 500 });
  }
}
