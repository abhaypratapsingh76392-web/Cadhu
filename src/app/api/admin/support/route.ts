import { NextResponse } from "next/server";
import { db } from "@/db";
import { supportChats, supportMessages, users } from "@/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { sanitize } from "@/lib/utils";
import { syncChat, syncMessage } from "@/lib/firebase";

export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const chatId = new URL(req.url).searchParams.get("chatId");
  const chats = await db.select().from(supportChats).orderBy(desc(supportChats.updatedAt)).limit(100);
  const uRows = await db.select({ id: users.id, name: users.name, email: users.email }).from(users);
  const map = new Map(uRows.map((u) => [u.id, u]));
  const enriched = chats.map((c) => ({ ...c, user: map.get(c.userId) || null }));
  if (!chatId) return NextResponse.json({ chats: enriched });
  const msgs = await db.select().from(supportMessages).where(eq(supportMessages.chatId, chatId)).orderBy(asc(supportMessages.createdAt));
  await db.update(supportChats).set({ unreadByAdmin: 0 }).where(eq(supportChats.id, chatId));
  return NextResponse.json({ chats: enriched, messages: msgs });
}

export async function POST(req: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const chatId = String(body.chatId || "");
    const text = sanitize(String(body.body || ""), 2000);
    if (!chatId || !text) return NextResponse.json({ error: "Chat and message required" }, { status: 400 });
    const rows = await db.select().from(supportChats).where(eq(supportChats.id, chatId)).limit(1);
    const chat = rows[0];
    if (!chat) return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    const inserted = await db
      .insert(supportMessages)
      .values({ chatId, senderRole: "admin", senderId: admin.id, body: text })
      .returning();
    await db.update(supportChats).set({ lastMessage: text, unreadByUser: chat.unreadByUser + 1, updatedAt: new Date() }).where(eq(supportChats.id, chatId));
    void syncMessage(inserted[0].id);
    void syncChat(chatId);
    return NextResponse.json({ ok: true, message: inserted[0] });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Reply failed" }, { status: 500 });
  }
}
