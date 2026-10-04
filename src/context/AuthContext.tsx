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
import { doc, getDoc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { INITIAL_CATEGORIES, INITIAL_HOUSEHOLD, INITIAL_MEMBERS } from '../data/initialData';
import {
  createCloudHouseholdDocId,
  LOCAL_HOUSEHOLD_ID,
  normalizeCloudHouseholdDocId,
} from '../sync/householdIdentity';
import { householdPath, householdSubcollectionPath } from '../sync/firestorePaths';
import { SYNC_SCHEMA_VERSION } from '../sync/firestoreMappers';
import { Category, Household, Membership } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  profileLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  householdId: string;
  privateLedgerId: string | null;
  setVerifiedHouseholdId: (id: string) => Promise<void>;
  syncStatus: 'synced' | 'syncing' | 'offline' | 'error';
  setSyncStatus: (status: 'synced' | 'syncing' | 'offline' | 'error') => void;
  authError: string | null;
}

export const AUTH_STATUS_KEY = 'env_budget_auth_status';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface UserProfileData {
  activeLedgerId?: unknown;
  privateLedgerId?: unknown;
}

function normalizeEmail(email: string | null): string {
  return (email || '').trim().toLowerCase();
}

function withHouseholdId<T extends { household_id: string }>(item: T, householdId: string): T {
  return { ...item, household_id: householdId };
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
  const members: Membership[] = INITIAL_MEMBERS.map(member => ({
    ...withHouseholdId(member, ledgerId),
    id: `mem_${currentUser.uid}`,
    user_id: currentUser.uid,
    name: currentUser.displayName || ownerEmail.split('@')[0] || 'You',
    role: 'owner',
    email: ownerEmail,
    avatar_url: currentUser.photoURL || undefined,
    joined_at: nowIso,
  }));
  const categories: Category[] = INITIAL_CATEGORIES.map(category => ({
    ...withHouseholdId(category, ledgerId),
    created_at: nowIso,
    updated_at: nowIso,
  }));

  const batch = writeBatch(db);
  batch.set(doc(db, householdPath(ledgerId)), {
    ...household,
    updated_by_uid: currentUser.uid,
    schema_version: SYNC_SCHEMA_VERSION,
    sync_version: 1,
    first_time_intro_completed: Boolean(household.first_time_intro_completed),
    first_time_intro_completed_at: household.first_time_intro_completed_at || null,
  });
  for (const member of members) {
    batch.set(doc(db, householdSubcollectionPath(ledgerId, 'members'), member.id), member);
  }
  for (const category of categories) {
    batch.set(doc(db, householdSubcollectionPath(ledgerId, 'categories'), category.id), category);
  }
  batch.set(
    doc(db, 'users', currentUser.uid),
    {
      uid: currentUser.uid,
      email: currentUser.email,
      displayName: currentUser.displayName,
      photoURL: currentUser.photoURL,
      privateLedgerId: ledgerId,
      activeLedgerId: ledgerId,
      ...(userProfileExists ? {} : { createdAt: serverTimestamp() }),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  await batch.commit();

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

  const persistActiveLedgerId = async (currentUser: User, ledgerId: string): Promise<string> => {
    const cloudLedgerId = normalizeCloudHouseholdDocId(ledgerId);
    if (!cloudLedgerId) {
      throw new Error('A generated cloud ledger id is required.');
    }

    setHouseholdIdState(cloudLedgerId);
    await setDoc(
      doc(db, 'users', currentUser.uid),
      {
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName,
        photoURL: currentUser.photoURL,
        activeLedgerId: cloudLedgerId,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return cloudLedgerId;
  };

  const setVerifiedHouseholdId = async (id: string) => {
    if (!user) throw new Error('Sign in before selecting a cloud ledger.');
    await persistActiveLedgerId(user, id);
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
            let privateId = normalizeCloudHouseholdDocId(String(profile?.privateLedgerId || ''));
            let activeId = normalizeCloudHouseholdDocId(String(profile?.activeLedgerId || ''));

            const createdPrivateLedger = !privateId;
            if (!privateId) {
              privateId = await createPrivateLedgerForUser(currentUser, userSnap.exists());
            }
            if (!activeId) {
              activeId = privateId;
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
                  ...(userSnap.exists() ? {} : { createdAt: serverTimestamp() }),
                  updatedAt: serverTimestamp(),
                },
                { merge: true }
              );
            }

            setPrivateLedgerId(privateId);
            setHouseholdIdState(activeId);
          } catch (err: unknown) {
            console.error('Error fetching/creating user profile:', err);
            setHouseholdIdState(LOCAL_HOUSEHOLD_ID);
            setPrivateLedgerId(null);
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
