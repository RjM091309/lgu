import { ControlPanelPage } from '@/components/access/ControlPanelPage';
import { RolesPage } from '@/components/access/RolesPage';
import { UsersPage } from '@/components/access/UsersPage';

interface AccessViewProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
}

export function AccessView({ activeTab, onNavigate }: AccessViewProps) {
  if (activeTab === 'access-roles') return <RolesPage />;
  if (activeTab === 'access-control-panel') return <ControlPanelPage onNavigate={onNavigate} />;
  return <UsersPage />;
}
