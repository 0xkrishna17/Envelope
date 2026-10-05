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
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { INITIAL_HOUSEHOLD } from '../data/initialData';
import {
  createCloudHouseholdDocId,
  LOCAL_HOUSEHOLD_ID,
  normalizeCloudHouseholdDocId,
} from '../sync/householdIdentity';
import { householdPath } from '../sync/firestorePaths';
import { SYNC_SCHEMA_VERSION } from '../sync/schema';
import { Household } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  profileLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  householdId: string;
  privateLedgerId: string | null;
  sharedLedgerId: string | null;
  userProfileCompleted: boolean;
  userIntroCompleted: boolean;
  markUserProfileCompleted: () => Promise<void>;
  markUserIntroCompleted: () => Promise<void>;
  setVerifiedHouseholdId: (id: string, sharedLedgerId?: string | null) => Promise<void>;
  syncStatus: 'synced' | 'syncing' | 'offline' | 'error';
  setSyncStatus: (status: 'synced' | 'syncing' | 'offline' | 'error') => void;
  authError: string | null;
}

export const AUTH_STATUS_KEY = 'env_budget_auth_status';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface UserProfileData {
  activeLedgerId?: unknown;
  privateLedgerId?: unknown;
  sharedLedgerId?: unknown;
  profileCompleted?: unknown;
  introCompleted?: unknown;
}

function normalizeEmail(email: string | null): string {
  return (email || '').trim().toLowerCase();
}

async function createPrivateLedgerForUser(currentUser: User, userProfileExists: boolean): Promise<string> {
  const ownerEmail = normalizeEmail(currentUser.email);
  if (!ownerEmail) {
    throw new Error('A Google account email is required to create a private ledger.');
  }

  const ledgerId = createCloudHouseholdDocId();
  const nowIso = new Date().toISOString();
  const household: Household = {
    ...INITIAL_HOUSEHOLD,
    id: ledgerId,
    owner_uid: currentUser.uid,
    owner_email: ownerEmail,
    allowed_emails: [ownerEmail],
    member_uids: [currentUser.uid],
    created_by: currentUser.uid,
    created_at: nowIso,
    updated_at: nowIso,
  };
  await setDoc(doc(db, householdPath(ledgerId)), {
    ...household,
    updated_by_uid: currentUser.uid,
    schema_version: SYNC_SCHEMA_VERSION,
    sync_version: 1,
    first_time_intro_completed: Boolean(household.first_time_intro_completed),
    first_time_intro_completed_at: household.first_time_intro_completed_at || null,
  });
  await setDoc(
    doc(db, 'users', currentUser.uid),
    {
      uid: currentUser.uid,
      email: currentUser.email,
      displayName: currentUser.displayName,
      photoURL: currentUser.photoURL,
      privateLedgerId: ledgerId,
      activeLedgerId: ledgerId,
      sharedLedgerId: null,
      ...(userProfileExists ? {} : { createdAt: serverTimestamp() }),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return ledgerId;
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [profileLoading, setProfileLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline' | 'error'>('synced');
  const [householdId, setHouseholdIdState] = useState<string>(LOCAL_HOUSEHOLD_ID);
  const [privateLedgerId, setPrivateLedgerId] = useState<string | null>(null);
  const [sharedLedgerId, setSharedLedgerId] = useState<string | null>(null);
  const [userProfileCompleted, setUserProfileCompleted] = useState<boolean>(false);
  const [userIntroCompleted, setUserIntroCompleted] = useState<boolean>(false);

  const persistActiveLedgerId = async (currentUser: User, ledgerId: string, nextSharedLedgerId?: string | null): Promise<string> => {
    const cloudLedgerId = normalizeCloudHouseholdDocId(ledgerId);
    if (!cloudLedgerId) {
      throw new Error('A generated cloud ledger id is required.');
    }

    const normalizedSharedLedgerId = typeof nextSharedLedgerId === 'undefined'
      ? undefined
      : normalizeCloudHouseholdDocId(nextSharedLedgerId || '');

    setHouseholdIdState(cloudLedgerId);
    if (typeof nextSharedLedgerId !== 'undefined') {
      setSharedLedgerId(normalizedSharedLedgerId || null);
    }
    await setDoc(
      doc(db, 'users', currentUser.uid),
      {
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName,
        photoURL: currentUser.photoURL,
        activeLedgerId: cloudLedgerId,
        ...(typeof nextSharedLedgerId === 'undefined' ? {} : { sharedLedgerId: normalizedSharedLedgerId || null }),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return cloudLedgerId;
  };

  const setVerifiedHouseholdId = async (id: string, nextSharedLedgerId?: string | null) => {
    if (!user) throw new Error('Sign in before selecting a cloud ledger.');
    await persistActiveLedgerId(user, id, nextSharedLedgerId);
  };

  const markUserProfileCompleted = async () => {
    if (!user) {
      setUserProfileCompleted(true);
      return;
    }

    await setDoc(
      doc(db, 'users', user.uid),
      {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        profileCompleted: true,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    setUserProfileCompleted(true);
  };

  const markUserIntroCompleted = async () => {
    if (!user) {
      setUserIntroCompleted(true);
      return;
    }

    await setDoc(
      doc(db, 'users', user.uid),
      {
        uid: user.uid,
        email: user.email,
        introCompleted: true,
        introCompletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    setUserIntroCompleted(true);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, currentUser => {
      setUser(currentUser);
      setLoading(false);
      setProfileLoading(Boolean(currentUser));

      if (currentUser) {
        try {
          localStorage.setItem(AUTH_STATUS_KEY, 'signed_in');
        } catch {}

        (async () => {
          try {
            const userRef = doc(db, 'users', currentUser.uid);
            const userSnap = await getDoc(userRef);
            const profile = userSnap.exists() ? (userSnap.data() as UserProfileData) : null;
            setUserProfileCompleted(Boolean(profile?.profileCompleted));
            setUserIntroCompleted(Boolean(profile?.introCompleted));
            let privateId = normalizeCloudHouseholdDocId(String(profile?.privateLedgerId || ''));
            let activeId = normalizeCloudHouseholdDocId(String(profile?.activeLedgerId || ''));
            let sharedId = normalizeCloudHouseholdDocId(String(profile?.sharedLedgerId || ''));

            const createdPrivateLedger = !privateId;
            if (!privateId) {
              privateId = await createPrivateLedgerForUser(currentUser, userSnap.exists());
            }
            if (!activeId) {
              activeId = privateId;
            }
            if (!sharedId && activeId !== privateId) {
              sharedId = activeId;
            }
            if (sharedId === privateId) {
              sharedId = '';
            }

            if (!createdPrivateLedger) {
              await setDoc(
                userRef,
                {
                  uid: currentUser.uid,
                  email: currentUser.email,
                  displayName: currentUser.displayName,
                  photoURL: currentUser.photoURL,
                  privateLedgerId: privateId,
                  activeLedgerId: activeId,
                  sharedLedgerId: sharedId || null,
                  ...(userSnap.exists() ? {} : { createdAt: serverTimestamp() }),
                  updatedAt: serverTimestamp(),
                },
                { merge: true }
              );
            }

            setPrivateLedgerId(privateId);
            setSharedLedgerId(sharedId || null);
            setHouseholdIdState(activeId);
          } catch (err: unknown) {
            console.error('Error fetching/creating user profile:', err);
            setHouseholdIdState(LOCAL_HOUSEHOLD_ID);
            setPrivateLedgerId(null);
            setSharedLedgerId(null);
            setUserProfileCompleted(false);
            setUserIntroCompleted(false);
            setAuthError(err instanceof Error ? err.message : 'Failed to prepare your private ledger.');
          } finally {
            setProfileLoading(false);
          }
        })();
      } else {
        try {
          localStorage.removeItem(AUTH_STATUS_KEY);
        } catch {}
        setHouseholdIdState(LOCAL_HOUSEHOLD_ID);
        setPrivateLedgerId(null);
        setSharedLedgerId(null);
        setUserProfileCompleted(false);
        setUserIntroCompleted(false);
        setProfileLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      console.error('Google sign-in error:', err);
      const message = err instanceof Error ? err.message : 'Failed to sign in with Google';
      setAuthError(message);
      throw err;
    }
  };

  const logout = async () => {
    setAuthError(null);
    try {
      localStorage.removeItem(AUTH_STATUS_KEY);
      setHouseholdIdState(LOCAL_HOUSEHOLD_ID);
      setPrivateLedgerId(null);
      setSharedLedgerId(null);
      setUserProfileCompleted(false);
      setUserIntroCompleted(false);
      await signOut(auth);
    } catch (err: unknown) {
      console.error('Logout error:', err);
      setAuthError(err instanceof Error ? err.message : 'Logout failed');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        profileLoading,
        signInWithGoogle,
        logout,
        householdId,
        privateLedgerId,
        sharedLedgerId,
        userProfileCompleted,
        userIntroCompleted,
        markUserProfileCompleted,
        markUserIntroCompleted,
        setVerifiedHouseholdId,
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
