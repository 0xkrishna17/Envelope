import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  auth,
  googleProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
  db,
} from '../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  householdId: string;
  setHouseholdId: (id: string) => void;
  syncStatus: 'synced' | 'syncing' | 'offline' | 'error';
  setSyncStatus: (status: 'synced' | 'syncing' | 'offline' | 'error') => void;
  authError: string | null;
}

const DEFAULT_HOUSEHOLD_ID = 'hh_family_ledger_main';
const HOUSEHOLD_STORAGE_KEY = 'env_budget_active_household_id';
export const AUTH_STATUS_KEY = 'env_budget_auth_status';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline' | 'error'>('synced');
  const [householdId, setHouseholdIdState] = useState<string>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlHh = params.get('household');
      if (urlHh && urlHh.trim()) {
        const clean = urlHh.trim();
        localStorage.setItem(HOUSEHOLD_STORAGE_KEY, clean);
        return clean;
      }
    } catch {}
    return localStorage.getItem(HOUSEHOLD_STORAGE_KEY) || DEFAULT_HOUSEHOLD_ID;
  });

  const householdIdRef = React.useRef(householdId);
  useEffect(() => {
    householdIdRef.current = householdId;
  }, [householdId]);

  const setHouseholdId = (id: string) => {
    setHouseholdIdState(id);
    localStorage.setItem(HOUSEHOLD_STORAGE_KEY, id);
    if (user) {
      // Save household mapping in user profile
      const userRef = doc(db, 'users', user.uid);
      setDoc(
        userRef,
        {
          activeHouseholdId: id,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch(err => console.error('Error updating user household:', err));
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, currentUser => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        try {
          localStorage.setItem(AUTH_STATUS_KEY, 'signed_in');
        } catch {}

        // Asynchronously fetch/sync user profile in background without holding UI loading state
        (async () => {
          try {
            let targetHouseholdId = householdIdRef.current;
            try {
              const params = new URLSearchParams(window.location.search);
              const urlHh = params.get('household');
              if (urlHh && urlHh.trim()) {
                targetHouseholdId = urlHh.trim();
              }
            } catch {}

            const userRef = doc(db, 'users', currentUser.uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
              const data = userSnap.data();
              // Only adopt saved household if no explicit URL param was provided
              const params = new URLSearchParams(window.location.search);
              if (!params.get('household') && data?.activeHouseholdId) {
                setHouseholdIdState(data.activeHouseholdId);
                localStorage.setItem(HOUSEHOLD_STORAGE_KEY, data.activeHouseholdId);
              } else if (params.get('household')) {
                // Update user record with the new household from URL
                await setDoc(userRef, { activeHouseholdId: targetHouseholdId }, { merge: true });
              }
            } else {
              // First time login - save profile
              await setDoc(userRef, {
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: currentUser.displayName,
                photoURL: currentUser.photoURL,
                activeHouseholdId: targetHouseholdId || DEFAULT_HOUSEHOLD_ID,
                createdAt: serverTimestamp(),
              });
            }
          } catch (err: any) {
            console.error('Error fetching/creating user profile:', err);
          }
        })();
      } else {
        try {
          localStorage.removeItem(AUTH_STATUS_KEY);
        } catch {}
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      // Handle iframe / popup blocker
      setAuthError(err.message || 'Failed to sign in with Google');
      throw err;
    }
  };

  const logout = async () => {
    setAuthError(null);
    try {
      localStorage.removeItem(AUTH_STATUS_KEY);
      await signOut(auth);
    } catch (err: any) {
      console.error('Logout error:', err);
      setAuthError(err.message);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithGoogle,
        logout,
        householdId,
        setHouseholdId,
        syncStatus,
        setSyncStatus,
        authError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
