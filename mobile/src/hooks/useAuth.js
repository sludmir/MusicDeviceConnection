import { useEffect, useState, useCallback } from 'react';
import { signOut, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

// True when the app has at least one Google OAuth client ID configured.
// The Google.useAuthRequest hook crashes synchronously if the current platform's
// client ID is missing — so GoogleSignInButton is only mounted when this is true.
export const googleConfigured = !!(
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ||
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
);

export async function ensureUserDoc(user) {
  const userRef = doc(db, 'users', user.uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    await setDoc(userRef, {
      displayName: user.displayName || (user.isAnonymous ? 'Guest' : ''),
      email: user.email || '',
      photoURL: user.photoURL || '',
      isAnonymous: !!user.isAnonymous,
      followers: [],
      following: [],
      createdAt: serverTimestamp(),
    });
  }
}

export function useAuth() {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setInitializing(false);
    });
    return unsub;
  }, []);

  const signInAsGuest = useCallback(async () => {
    setSigningIn(true);
    try {
      const cred = await signInAnonymously(auth);
      await ensureUserDoc(cred.user);
    } catch (err) {
      console.warn('anonymous sign-in failed', err);
    } finally {
      setSigningIn(false);
    }
  }, []);

  const logout = useCallback(() => signOut(auth), []);

  return { user, initializing, signingIn, setSigningIn, signInAsGuest, logout };
}
