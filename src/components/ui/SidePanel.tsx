import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';

interface SidePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  onSave?: () => void;
  onCancel?: () => void;
  saveLabel?: string;
  cancelLabel?: string;
  widthClassName?: string;
}

export function SidePanel({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSave,
  onCancel,
  saveLabel = 'Save',
  cancelLabel = 'Cancel',
  widthClassName = 'w-full sm:w-[460px]',
}: SidePanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" closeOnOverlayClick={false} className={`${widthClassName} p-0`}>
        <div className="h-full flex flex-col bg-white">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-lg font-bold text-primary">{title}</h2>
            {description && <p className="text-xs text-text-muted mt-1">{description}</p>}
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
          <div className="border-t border-border px-6 py-4 flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => (onCancel ? onCancel() : onOpenChange(false))}>
              {cancelLabel}
            </Button>
            {onSave && <Button onClick={onSave}>{saveLabel}</Button>}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
