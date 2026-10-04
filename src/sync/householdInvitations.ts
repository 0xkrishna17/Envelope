import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  Firestore,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db as appDb } from '../lib/firebase';
import { HouseholdInvitation, Membership } from '../types';
import { householdPath, householdSubcollectionPath } from './firestorePaths';
import { isValidCloudHouseholdId } from './householdIdentity';
import { SyncResult, syncFailure, syncSuccess } from './types';

export const INVITATIONS_COLLECTION = 'householdInvitations';
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getFirestore(): Firestore | null {
  return appDb || null;
}

export function normalizeInvitationEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateInvitationEmail(email: string): string | null {
  const normalized = normalizeInvitationEmail(email);
  return normalized && EMAIL_PATTERN.test(normalized) ? normalized : null;
}

export function householdInvitationDocId(householdId: string, inviteeEmail: string): string {
  return `${householdId}__${normalizeInvitationEmail(inviteeEmail)}`;
}

function mapInvitation(id: string, data: Record<string, unknown>): HouseholdInvitation {
  return {
    id,
    household_id: String(data.household_id || ''),
    household_name: String(data.household_name || 'Family Budget'),
    inviter_uid: String(data.inviter_uid || ''),
    inviter_email: String(data.inviter_email || ''),
    invitee_email: String(data.invitee_email || ''),
    invitee_uid: typeof data.invitee_uid === 'string' ? data.invitee_uid : undefined,
    status: data.status === 'accepted' || data.status === 'declined' || data.status === 'revoked' ? data.status : 'pending',
    created_at: String(data.created_at || ''),
    updated_at: String(data.updated_at || ''),
    responded_at: typeof data.responded_at === 'string' ? data.responded_at : undefined,
  };
}

function mapError(err: unknown): SyncResult {
  const code = typeof err === 'object' && err !== null && 'code' in err ? String(err.code) : '';
  if (code === 'permission-denied') {
    return syncFailure('permission_denied', 'This Google account is not allowed to perform that household request action.');
  }
  return syncFailure('unknown', err instanceof Error ? err.message : 'Household request action failed.');
}

function syncedNow(): string {
  return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export async function createHouseholdInvitation(params: {
  householdId: string;
  householdName: string;
  inviterUid: string;
  inviterEmail: string;
  inviteeEmail: string;
}): Promise<SyncResult> {
  const firestore = getFirestore();
  if (!firestore) return syncFailure('network', 'Firestore is not available in this environment.');

  const inviteeEmail = validateInvitationEmail(params.inviteeEmail);
  const inviterEmail = validateInvitationEmail(params.inviterEmail);
  if (!inviteeEmail || !inviterEmail) {
    return syncFailure('unknown', 'Please enter a valid Google email address.');
  }
  if (!isValidCloudHouseholdId(params.householdId)) {
    return syncFailure('unknown', 'A verified cloud ledger is required before inviting members.');
  }
  if (inviteeEmail === inviterEmail) {
    return syncFailure('unknown', 'You are already the owner of this household.');
  }

  try {
    const existing = await getDocs(
      query(
        collection(firestore, INVITATIONS_COLLECTION),
        where('household_id', '==', params.householdId),
        where('invitee_email', '==', inviteeEmail),
        where('status', '==', 'pending')
      )
    );
    if (!existing.empty) {
      return syncFailure('unknown', 'This email already has a pending household request.');
    }

    const nowIso = new Date().toISOString();
    await setDoc(doc(firestore, INVITATIONS_COLLECTION, householdInvitationDocId(params.householdId, inviteeEmail)), {
      household_id: params.householdId,
      household_name: params.householdName,
      inviter_uid: params.inviterUid,
      inviter_email: inviterEmail,
      invitee_email: inviteeEmail,
      status: 'pending',
      created_at: nowIso,
      updated_at: nowIso,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return syncSuccess(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), 0);
  } catch (err) {
    return mapError(err);
  }
}

export async function listPendingHouseholdInvitations(email: string): Promise<HouseholdInvitation[]> {
  const firestore = getFirestore();
  const inviteeEmail = validateInvitationEmail(email);
  if (!firestore || !inviteeEmail) return [];

  const snapshot = await getDocs(
    query(
      collection(firestore, INVITATIONS_COLLECTION),
      where('invitee_email', '==', inviteeEmail),
      where('status', '==', 'pending')
    )
  );

  return snapshot.docs.map(item => mapInvitation(item.id, item.data()));
}

export async function listOwnedHouseholdInvitations(params: {
  householdId: string;
  inviterUid: string;
}): Promise<HouseholdInvitation[]> {
  const firestore = getFirestore();
  if (!firestore || !isValidCloudHouseholdId(params.householdId)) return [];

  const snapshot = await getDocs(
    query(
      collection(firestore, INVITATIONS_COLLECTION),
      where('household_id', '==', params.householdId),
      where('inviter_uid', '==', params.inviterUid),
      where('status', '==', 'pending')
    )
  );

  return snapshot.docs.map(item => mapInvitation(item.id, item.data()));
}

export async function acceptHouseholdInvitation(params: {
  invitationId: string;
  userUid: string;
  userEmail: string;
  displayName?: string | null;
  photoURL?: string | null;
}): Promise<SyncResult & { householdId?: string }> {
  const firestore = getFirestore();
  if (!firestore) return syncFailure('network', 'Firestore is not available in this environment.');

  const userEmail = validateInvitationEmail(params.userEmail);
  if (!userEmail) return syncFailure('unknown', 'Sign in with a Google account email before accepting.');

  try {
    const invitationRef = doc(firestore, INVITATIONS_COLLECTION, params.invitationId);
    const invitationSnap = await getDoc(invitationRef);
    if (!invitationSnap.exists()) {
      return syncFailure('unknown', 'This household request no longer exists.');
    }

    const invitation = mapInvitation(invitationSnap.id, invitationSnap.data());
    if (invitation.status !== 'pending') {
      return syncFailure('unknown', 'This household request has already been handled.');
    }
    if (invitation.invitee_email !== userEmail) {
      return syncFailure('permission_denied', 'This household request was sent to a different Google account.');
    }
    if (!isValidCloudHouseholdId(invitation.household_id)) {
      return syncFailure('unknown', 'This household request points to an invalid ledger.');
    }

    const householdRef = doc(firestore, householdPath(invitation.household_id));
    const nowIso = new Date().toISOString();
    const member: Membership = {
      id: `mem_${params.userUid}`,
      household_id: invitation.household_id,
      user_id: params.userUid,
      name: params.displayName || userEmail.split('@')[0] || 'Member',
      role: 'member',
      avatar_color: '#486B88',
      email: userEmail,
      avatar_url: params.photoURL || undefined,
      joined_at: nowIso,
    };

    const batch = writeBatch(firestore);
    batch.update(householdRef, {
      allowed_emails: arrayUnion(userEmail),
      member_uids: arrayUnion(params.userUid),
      updated_at: nowIso,
      updated_by_uid: params.userUid,
    });
    batch.set(doc(firestore, householdSubcollectionPath(invitation.household_id, 'members'), member.id), member, { merge: true });
    batch.update(doc(firestore, 'users', params.userUid), {
      activeLedgerId: invitation.household_id,
      updatedAt: serverTimestamp(),
    });
    batch.update(invitationRef, {
      invitee_uid: params.userUid,
      status: 'accepted',
      responded_at: nowIso,
      updated_at: nowIso,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();

    return {
      ...syncSuccess(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), 0),
      householdId: invitation.household_id,
    };
  } catch (err) {
    return mapError(err);
  }
}

export async function declineHouseholdInvitation(params: {
  invitationId: string;
  userEmail: string;
}): Promise<SyncResult> {
  const firestore = getFirestore();
  if (!firestore) return syncFailure('network', 'Firestore is not available in this environment.');

  const userEmail = validateInvitationEmail(params.userEmail);
  if (!userEmail) return syncFailure('unknown', 'Sign in with a Google account email before declining.');

  try {
    const invitationRef = doc(firestore, INVITATIONS_COLLECTION, params.invitationId);
    const invitationSnap = await getDoc(invitationRef);
    if (!invitationSnap.exists()) return syncFailure('unknown', 'This household request no longer exists.');
    const invitation = mapInvitation(invitationSnap.id, invitationSnap.data());
    if (invitation.invitee_email !== userEmail) {
      return syncFailure('permission_denied', 'This household request was sent to a different Google account.');
    }

    const nowIso = new Date().toISOString();
    await updateDoc(invitationRef, {
      status: 'declined',
      responded_at: nowIso,
      updated_at: nowIso,
      updatedAt: serverTimestamp(),
    });
    return syncSuccess(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), 0);
  } catch (err) {
    return mapError(err);
  }
}

export async function revokeHouseholdInvitation(params: {
  invitationId: string;
}): Promise<SyncResult> {
  const firestore = getFirestore();
  if (!firestore) return syncFailure('network', 'Firestore is not available in this environment.');

  try {
    const nowIso = new Date().toISOString();
    await updateDoc(doc(firestore, INVITATIONS_COLLECTION, params.invitationId), {
      status: 'revoked',
      updated_at: nowIso,
      updatedAt: serverTimestamp(),
    });
    return syncSuccess(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), 0);
  } catch (err) {
    return mapError(err);
  }
}

export async function revokeHouseholdMemberAccess(params: {
  householdId: string;
  ownerUid: string;
  memberUid: string;
  memberEmail: string;
}): Promise<SyncResult> {
  const firestore = getFirestore();
  if (!firestore) return syncFailure('network', 'Firestore is not available in this environment.');

  const memberEmail = validateInvitationEmail(params.memberEmail);
  if (!memberEmail) return syncFailure('unknown', 'Choose a valid Google email to revoke.');
  if (!isValidCloudHouseholdId(params.householdId)) {
    return syncFailure('unknown', 'A verified cloud ledger is required before revoking access.');
  }
  if (!params.memberUid) {
    return syncFailure('unknown', 'This accepted member is missing a user id; ask them to leave or reset the invite state.');
  }
  if (params.memberUid === params.ownerUid) {
    return syncFailure('permission_denied', 'Cannot remove the primary household owner from household access.');
  }

  try {
    const householdRef = doc(firestore, householdPath(params.householdId));
    const householdSnap = await getDoc(householdRef);
    if (!householdSnap.exists()) return syncFailure('unknown', 'The current household no longer exists.');

    const household = householdSnap.data();
    if (household.owner_uid !== params.ownerUid && household.created_by !== params.ownerUid) {
      return syncFailure('permission_denied', 'Only the household owner can revoke accepted member access.');
    }

    const nowIso = new Date().toISOString();
    const batch = writeBatch(firestore);
    batch.update(householdRef, {
      allowed_emails: arrayRemove(memberEmail),
      member_uids: arrayRemove(params.memberUid),
      updated_at: nowIso,
      updated_by_uid: params.ownerUid,
    });
    batch.set(
      doc(firestore, householdSubcollectionPath(params.householdId, 'members'), `mem_${params.memberUid}`),
      { deleted_at: nowIso },
      { merge: true }
    );
    await batch.commit();

    return syncSuccess(syncedNow(), 0);
  } catch (err) {
    return mapError(err);
  }
}

export async function leaveHousehold(params: {
  householdId: string;
  privateLedgerId: string;
  userUid: string;
  userEmail: string;
}): Promise<SyncResult> {
  const firestore = getFirestore();
  if (!firestore) return syncFailure('network', 'Firestore is not available in this environment.');

  const userEmail = validateInvitationEmail(params.userEmail);
  if (!userEmail) return syncFailure('unknown', 'Sign in with a Google account email before leaving.');
  if (!isValidCloudHouseholdId(params.householdId) || !isValidCloudHouseholdId(params.privateLedgerId)) {
    return syncFailure('unknown', 'A verified cloud ledger is required before leaving a household.');
  }
  if (params.householdId === params.privateLedgerId) {
    return syncFailure('permission_denied', 'You are already using your private ledger.');
  }

  try {
    const householdRef = doc(firestore, householdPath(params.householdId));
    const householdSnap = await getDoc(householdRef);
    if (!householdSnap.exists()) return syncFailure('unknown', 'The current household no longer exists.');
    const household = householdSnap.data();
    if (household.owner_uid === params.userUid) {
      return syncFailure('permission_denied', 'The household owner cannot leave their owned household.');
    }

    const nowIso = new Date().toISOString();
    const userRef = doc(firestore, 'users', params.userUid);
    const batch = writeBatch(firestore);
    batch.update(userRef, {
      activeLedgerId: params.privateLedgerId,
      updatedAt: serverTimestamp(),
    });
    batch.update(householdRef, {
      allowed_emails: arrayRemove(userEmail),
      member_uids: arrayRemove(params.userUid),
      updated_at: nowIso,
      updated_by_uid: params.userUid,
    });
    batch.update(doc(firestore, householdSubcollectionPath(params.householdId, 'members'), `mem_${params.userUid}`), {
      deleted_at: nowIso,
    });
    await batch.commit();

    return syncSuccess(syncedNow(), 0);
  } catch (err) {
    return mapError(err);
  }
}
