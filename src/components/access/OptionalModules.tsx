import { Blocks } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toast';
import { logActivity } from '@/lib/activity-log';
import { setEnabledModules, useSyncStatus } from '@/lib/esession-sync';
import { OPTIONAL_MODULES, useModules } from '@/lib/modules';

/**
 * Turns the optional parts of the Staff Portal on or off. Off by default: the client asked for e-sessions and
 * keeping the record of sessions, so the portal opens with just those. A module turned on shows for everyone
 * whose role has its pages, on every device, until the LIMS server restarts.
 */
export function OptionalModules() {
  const enabled = useModules();
  const status = useSyncStatus();

  const toggle = (id: string, label: string, on: boolean) => {
    setEnabledModules(on ? [...enabled, id] : enabled.filter((entry) => entry !== id));
    toast(on ? `${label} turned on` : `${label} turned off`, on ? 'It now shows in the sidebar for the roles that have it.' : 'It is hidden everywhere until it is turned on again; nothing in it is deleted.');
    logActivity({ module: 'Administration', action: 'Updated', summary: `Turned ${on ? 'on' : 'off'} the ${label} module` });
  };

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-5 py-2.5">
        <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-text-main">
          <Blocks className="h-3.5 w-3.5" />
          Optional modules
        </span>
        <span className="text-[11px] text-text-muted">{enabled.length ? `${enabled.length} of ${OPTIONAL_MODULES.length} on` : 'All off: E-Session and its records only'}</span>
      </header>
      <p className="border-b border-border px-5 py-3 text-xs text-text-muted">
        The portal is set up for what was asked for: e-sessions, their calendar and files, transcriptions, members and committees, attendance, and administration. These other LIMS modules are kept and can be turned on when needed. Changes apply on every device at once
        {status === 'live' ? '' : ' (the LIMS server cannot be reached, so only on this device for now)'}, and a server restart turns them off again.
      </p>
      <div className="grid divide-y divide-border md:grid-cols-2 md:divide-y-0">
        {OPTIONAL_MODULES.map((module, index) => {
          const on = enabled.includes(module.id);
          return (
            <div key={module.id} className={`flex items-start justify-between gap-4 px-5 py-4 ${index > 1 ? 'md:border-t md:border-border' : ''} ${index % 2 === 1 ? 'md:border-l md:border-border' : ''}`}>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-text-main">{module.label}</div>
                <div className="text-xs text-text-muted">{module.description}</div>
              </div>
              <Switch checked={on} onChange={(value) => toggle(module.id, module.label, value)} label={`${module.label} module`} />
            </div>
          );
        })}
      </div>
    </section>
  );
}
