import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toast';
import { ConfirmDialogHost, confirmAction } from '@/components/ui/confirm';
import { useUsers } from '@/lib/access-store';
import { logActivity } from '@/lib/activity-log';
import { mobileAccounts, type MobileAccount } from '@/lib/mobile-accounts';
import { setStaffArea } from '@/lib/theme';
import { readESessionAccount, writeESessionAccount } from '@/lib/esession-room';
import { ESessionLogin } from '@/components/esession-room/ESessionLogin';
import { ESessionLobby } from '@/components/esession-room/ESessionLobby';
import { ESessionHistory, ESessionRecord } from '@/components/esession-room/ESessionHistory';
import { ESessionRoom } from '@/components/esession-room/ESessionRoom';
import { useAppHead } from '@/lib/app-head';

// LIMS E-Session (/es): live sittings of the Sanggunian by video, for members of the body and the
// Secretariat, built for tablets first. Signed in separately from the Staff Portal, with the same
// accounts as LIMS Mobile. See server/esession-rooms.mjs for the room server.

export function ESessionApp() {
  // Its own home-screen shortcut and full-screen app on tablets.
  useAppHead({ manifest: '/esession.webmanifest', homeScreenName: 'E-Session', title: 'LIMS E-Session' });
  // The dark theme (chosen on the Staff Portal or here) applies to the signed-in screens, as on the portal.
  useLayoutEffect(() => setStaffArea(true), []);

  const users = useUsers();
  const navigate = useNavigate();
  const [accountId, setAccountId] = useState(readESessionAccount);
  const account = useMemo(() => mobileAccounts(users).find((entry) => entry.inviteeId === accountId) ?? null, [users, accountId]);

  const signIn = (next: MobileAccount, remember: boolean) => {
    writeESessionAccount(next.inviteeId, remember);
    logActivity({ user: next.username, module: 'Authentication', action: 'Signed in', summary: 'Signed in to E-Session' });
    setAccountId(next.inviteeId);
  };

  const signOut = useCallback(async () => {
    if (!account) return;
    const confirmed = await confirmAction({ title: 'Sign out of E-Session?', description: 'You will need your username and password to join an e-session again on this device.', confirmLabel: 'Sign out' });
    if (!confirmed) return;
    logActivity({ user: account.username, module: 'Authentication', action: 'Signed out', summary: 'Signed out of E-Session' });
    writeESessionAccount(null);
    setAccountId(null);
    navigate('/es', { replace: true });
  }, [account, navigate]);

  return (
    <div className="min-h-dvh bg-background font-sans antialiased">
      {account ? (
        <Routes>
          <Route index element={<ESessionLobby account={account} onSignOut={signOut} />} />
          <Route path="history" element={<ESessionHistory account={account} onSignOut={signOut} />} />
          <Route path="history/:roomId" element={<ESessionRecord account={account} onSignOut={signOut} />} />
          <Route path="session/:sessionId" element={<ESessionRoom account={account} />} />
          <Route path="*" element={<Navigate to="/es" replace />} />
        </Routes>
      ) : (
        <ESessionLogin onSignIn={signIn} />
      )}
      <Toaster className="left-1/2 top-3 -translate-x-1/2" />
      <ConfirmDialogHost />
    </div>
  );
}
