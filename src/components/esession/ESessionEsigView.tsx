import { SessionFilesPanel } from '@/components/esession/SessionFilesPanel';
import { SessionPlatformPanel } from '@/components/esession/SessionPlatformPanel';
import { ESignaturePanel } from '@/components/esession/ESignaturePanel';

interface ESessionEsigViewProps {
  activeTab: string;
}

export function ESessionEsigView({ activeTab }: ESessionEsigViewProps) {
  if (activeTab === 'esig-platform') return <SessionPlatformPanel />;
  if (activeTab === 'esig-electronic-signature') return <ESignaturePanel />;
  return <SessionFilesPanel />;
}
