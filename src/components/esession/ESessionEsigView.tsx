import { SessionFilesPanel } from '@/components/esession/SessionFilesPanel';
import { SessionPlatformPanel } from '@/components/esession/SessionPlatformPanel';
import { ESignaturePanel } from '@/components/esession/ESignaturePanel';
import { CalendarSessionsPanel } from '@/components/esession/CalendarSessionsPanel';

interface ESessionEsigViewProps {
  activeTab: string;
}

export function ESessionEsigView({ activeTab }: ESessionEsigViewProps) {
  if (activeTab === 'esig-calendar-sessions') return <CalendarSessionsPanel />;
  if (activeTab === 'esig-platform') return <SessionPlatformPanel />;
  if (activeTab === 'esig-electronic-signature') return <ESignaturePanel />;
  return <SessionFilesPanel />;
}
