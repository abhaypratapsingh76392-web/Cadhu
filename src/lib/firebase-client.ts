"use client";

// Firebase Authentication client — Google sign-in popup.
// Config comes from the server (admin-pasted Firebase config). No Google Client ID needed.
export async function signInWithGoogleFirebase(): Promise<{ idToken: string } | { error: string }> {
  try {
    const res = await fetch("/api/config/firebase");
    if (!res.ok) {
      return { error: "Google login abhi available nahi — admin ko Firebase config set karna hoga (Admin Panel → Settings). Email login use karein." };
    }
    const config = await res.json();
    const { initializeApp, getApps } = await import("firebase/app");
    const { getAuth, GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
    const app = getApps().length ? getApps()[0] : initializeApp(config);
    const auth = getAuth(app);
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const idToken = await result.user.getIdToken();
    return { idToken };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Google sign-in failed";
    if (msg.includes("popup-closed") || msg.includes("cancelled-popup")) return { error: "Google sign-in cancel ho gaya." };
    if (msg.includes("operation-not-allowed")) return { error: "Firebase Console → Authentication → Sign-in method me Google enable karein." };
    if (msg.includes("unauthorized-domain") || msg.includes("auth/unauthorized")) return { error: "Firebase Console → Authentication → Settings → Authorized domains me is domain ko add karein." };
    return { error: msg };
  }
}
