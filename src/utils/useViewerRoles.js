import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

// Viewer roles for the signed-in user. `isAdmin` reads the Firebase custom
// `admin` claim (same claim that gates product writes). `isCreator` reads the
// admin-granted `creator` flag on users/{uid} — it gates live-set posting
// (mirrored server-side by the isCreator() check in firestore.rules). Admins
// count as creators.
export default function useViewerRoles() {
  const [roles, setRoles] = useState({ isCreator: false, isAdmin: false, loading: true });

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (!cancelled) setRoles({ isCreator: false, isAdmin: false, loading: false });
        return;
      }
      try {
        const [token, snap] = await Promise.all([
          user.getIdTokenResult(),
          getDoc(doc(db, 'users', user.uid)),
        ]);
        if (cancelled) return;
        const isAdmin = token.claims.admin === true;
        setRoles({
          isCreator: isAdmin || (snap.exists() && snap.data().creator === true),
          isAdmin,
          loading: false,
        });
      } catch (err) {
        console.error('Error loading viewer roles:', err);
        if (!cancelled) setRoles({ isCreator: false, isAdmin: false, loading: false });
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return roles;
}
