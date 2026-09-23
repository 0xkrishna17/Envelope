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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline' | 'error'>('synced');
  const [householdId, setHouseholdIdState] = useState<string>(() => {
    return localStorage.getItem(HOUSEHOLD_STORAGE_KEY) || DEFAULT_HOUSEHOLD_ID;
  });

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
    const unsubscribe = onAuthStateChanged(auth, async currentUser => {
      setUser(currentUser);
      if (currentUser) {
        try {
          // Check if user has an existing household mapped
          const userRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            const data = userSnap.data();
            if (data?.activeHouseholdId) {
              setHouseholdIdState(data.activeHouseholdId);
              localStorage.setItem(HOUSEHOLD_STORAGE_KEY, data.activeHouseholdId);
            }
          } else {
            // First time login - save profile
            await setDoc(userRef, {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName,
              photoURL: currentUser.photoURL,
              activeHouseholdId: householdId || DEFAULT_HOUSEHOLD_ID,
              createdAt: serverTimestamp(),
            });
          }
        } catch (err: any) {
          console.error('Error fetching/creating user profile:', err);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [householdId]);

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
