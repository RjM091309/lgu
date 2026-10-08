import { useEffect, useState } from 'react';
import { toast } from '@/components/ui/toast';
import { useAccess, useUsers } from '@/lib/access-store';
import { fetchServerInfo, writeESessionAccount } from '@/lib/esession-room';
import { mobileAccounts } from '@/lib/mobile-accounts';

/**
 * Opens E-Session (or one sitting in it) in its own window beside the Staff Portal, on the server's https address,
 * where the camera and microphone work. On that same address the window is signed in already as this person;
 * coming from the http address it asks for the password, with the username filled in.
 * `account` is null for roles that do not take part in sessions (they get no button).
 */
export function useOpenESession() {
  const { user } = useAccess();
  const account = mobileAccounts(useUsers()).find((entry) => entry.inviteeId === `user:${user.id}`) ?? null;
  const [httpsPort, setHttpsPort] = useState<number | null>(null);
  useEffect(() => {
    void fetchServerInfo().then((info) => setHttpsPort(info.httpsPort));
  }, []);

  const open = (path = '/es') => {
    if (!account) return;
    const sameAddress = window.location.protocol === 'https:' || !httpsPort;
    const url = sameAddress ? `${window.location.origin}${path}` : `https://${window.location.hostname}:${httpsPort}${path}?user=${encodeURIComponent(account.username)}`;
    // The new window starts with a copy of this tab's session sign-in (same address only).
    if (sameAddress) writeESessionAccount(account.inviteeId);
    const win = window.open(url, 'lims-esession');
    if (!win) return toast('E-Session did not open', 'The browser blocked the new window. Allow pop-ups for this site, or open /es in a new tab.', 'error');
    win.focus();
  };

  return { account, open };
}

/** The address of one sitting in E-Session. */
export const esessionPath = (sessionId: string) => `/es/session/${encodeURIComponent(sessionId)}`;
