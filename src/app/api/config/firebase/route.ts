import { NextResponse } from "next/server";
import { getFirebaseConfig } from "@/lib/firebase";

// Public Firebase web config — safe to expose (Firebase web config is public by design).
// Used by the landing/register pages for Firebase Authentication (Google sign-in).
export async function GET() {
  const cfg = await getFirebaseConfig();
  if (!cfg) return NextResponse.json({ error: "Firebase not configured" }, { status: 404 });
  return NextResponse.json({
    apiKey: cfg.apiKey,
    authDomain: cfg.authDomain || `${cfg.projectId}.firebaseapp.com`,
    projectId: cfg.projectId,
    storageBucket: cfg.storageBucket || `${cfg.projectId}.appspot.com`,
    messagingSenderId: cfg.messagingSenderId || "",
    appId: cfg.appId || "",
  });
}
