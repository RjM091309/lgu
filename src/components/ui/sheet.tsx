import * as React from "react";

import { cn } from "@/lib/utils";

type SheetContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const SheetContext = React.createContext<SheetContextValue | null>(null);

function useSheetContext() {
  const context = React.useContext(SheetContext);
  if (!context) throw new Error("Sheet components must be used inside Sheet");
  return context;
}

function Sheet({
  open,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const isControlled = open !== undefined;
  const resolvedOpen = isControlled ? open : uncontrolledOpen;
  const setOpen = (nextOpen: boolean) => {
    if (!isControlled) setUncontrolledOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  return <SheetContext.Provider value={{ open: resolvedOpen, setOpen }}>{children}</SheetContext.Provider>;
}

function SheetContent({
  className,
  side = "right",
  children,
  closeOnOverlayClick = true,
}: React.HTMLAttributes<HTMLDivElement> & { side?: "left" | "right"; closeOnOverlayClick?: boolean }) {
  const { open, setOpen } = useSheetContext();
  const [isMounted, setIsMounted] = React.useState(open);
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setIsMounted(true);
      const frame = requestAnimationFrame(() => setIsVisible(true));
      return () => cancelAnimationFrame(frame);
    }

    setIsVisible(false);
    const timeout = setTimeout(() => setIsMounted(false), 220);
    return () => clearTimeout(timeout);
  }, [open]);

  if (!isMounted) return null;

  const sideClasses = side === "left" ? "left-0" : "right-0";
  const hiddenTransform = side === "left" ? "-translate-x-full" : "translate-x-full";
  const visibleTransform = "translate-x-0";

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 bg-black/40 transition-opacity duration-200",
        isVisible ? "opacity-100" : "opacity-0"
      )}
      onClick={() => {
        if (closeOnOverlayClick) setOpen(false);
      }}
    >
      <div
        className={cn(
          "absolute top-0 h-full bg-background shadow-xl transition-transform duration-200",
          sideClasses,
          isVisible ? visibleTransform : hiddenTransform,
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export { Sheet, SheetContent };
