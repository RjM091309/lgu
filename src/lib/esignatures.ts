import { useSyncExternalStore } from 'react';
import { mockBills, mockMembers } from '@/lib/mock-data';

// Electronic signatures on approved measures. Kept in memory like the rest of the sample data,
// so signatures survive switching pages but reset on refresh.

export interface SignatureRecord {
  /** Display time, e.g. "Sep 28, 10:12 AM". */
  signedAt: string;
  /** PNG or SVG data URL of the drawn signature. */
  image: string;
}

export interface DocumentSignatures {
  signatures: Record<string, SignatureRecord>;
  lockedAt?: string;
  verificationCode?: string;
}

// Sample attendance for the current session: one councilor is absent and cannot sign.
const ABSENT_MEMBER_IDS = new Set([mockMembers[5]?.id]);
export const isPresent = (memberId: string) => !ABSENT_MEMBER_IDS.has(memberId);
export const presentMembers = mockMembers.filter((member) => isPresent(member.id));

/** Measures that passed or were enacted need the signatures of the members present. */
export const signableDocuments = mockBills.filter((bill) => bill.status === 'Passed' || bill.status === 'Enacted');

export const formatSignedAt = (date = new Date()) =>
  date.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

// A hand-drawn-looking stroke for the sample signatures, varied by seed.
function sampleSignature(seed: number) {
  const r = (n: number) => ((Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  let d = `M${10 + r(1) * 10} ${40 + r(2) * 10}`;
  let x = 20;
  for (let i = 0; i < 6; i++) {
    x += 20 + r(i + 3) * 18;
    d += ` q${8 + r(i + 9) * 10} ${-30 - r(i + 15) * 12} ${16 + r(i + 21) * 8} ${r(i + 27) * 16 - 4}`;
  }
  d += ` M${30 + r(40) * 20} ${58 + r(41) * 4} l${x - 40} ${-4 - r(42) * 6}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x + 40} 70"><path d="${d}" fill="none" stroke="#0a0f3d" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const seeded = (docId: string, memberIds: string[], times: string[]): DocumentSignatures => ({
  signatures: Object.fromEntries(
    memberIds.map((memberId, index) => [memberId, { signedAt: times[index % times.length], image: sampleSignature(index + docId.length * 7 + Number(docId)) }])
  ),
});

const presentIds = presentMembers.map((member) => member.id);

let state: Record<string, DocumentSignatures> = {
  // Mun. Ord. No. 2026-005: fully signed and locked.
  '3': {
    ...seeded('3', presentIds, ['Feb 9, 10:04 AM', 'Feb 9, 10:06 AM', 'Feb 9, 10:07 AM', 'Feb 9, 10:09 AM']),
    lockedAt: 'Feb 9, 11:20 AM',
    verificationCode: 'SBC-2026-7F3A-91C2',
  },
  // Mun. Ord. No. 2026-007: signing in progress.
  '4': seeded('4', presentIds.slice(0, 4), ['Sep 28, 09:12 AM', 'Sep 28, 09:15 AM', 'Sep 28, 09:21 AM', 'Sep 28, 09:30 AM']),
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useESignatures = () => useSyncExternalStore(subscribe, () => state);

export const signaturesFor = (all: Record<string, DocumentSignatures>, docId: string): DocumentSignatures => all[docId] ?? { signatures: {} };

export function signDocument(docId: string, memberId: string, image: string) {
  const current = signaturesFor(state, docId);
  if (current.lockedAt || current.signatures[memberId] || !isPresent(memberId)) return false;
  state = { ...state, [docId]: { ...current, signatures: { ...current.signatures, [memberId]: { signedAt: formatSignedAt(), image } } } };
  emit();
  return true;
}

export function lockDocument(docId: string) {
  const current = signaturesFor(state, docId);
  if (current.lockedAt) return current.verificationCode ?? '';
  const hex = () => Array.from(crypto.getRandomValues(new Uint8Array(2)), (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  const verificationCode = `SBC-${new Date().getFullYear()}-${hex()}-${hex()}`;
  state = { ...state, [docId]: { ...current, lockedAt: formatSignedAt(), verificationCode } };
  emit();
  return verificationCode;
}
