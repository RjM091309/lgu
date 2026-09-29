import { createContext, useContext } from 'react';
import type { MobileAccount } from '@/lib/mobile-accounts';
import type { Notice } from '@/lib/esession-sync';

export interface MobileContextValue {
  account: MobileAccount;
  signOut: () => void;
  /** Notices meant for the signed-in account, newest first. */
  notices: Notice[];
  /** Notices not yet opened in the Alerts tab. */
  unseenIds: string[];
  markNoticesSeen: () => void;
}

export const MobileContext = createContext<MobileContextValue | null>(null);

export const useMobile = () => {
  const value = useContext(MobileContext);
  if (!value) throw new Error('useMobile must be used inside the mobile app');
  return value;
};
