import * as React from "react";

import { cn } from "@/lib/utils";

type DropdownMenuContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const DropdownMenuContext = React.createContext<DropdownMenuContextValue | null>(null);

function useDropdownContext() {
  const context = React.useContext(DropdownMenuContext);
  if (!context) throw new Error("DropdownMenu components must be used inside DropdownMenu");
  return context;
}

function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <DropdownMenuContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block">{children}</div>
    </DropdownMenuContext.Provider>
  );
}

function DropdownMenuTrigger({ asChild, children }: { asChild?: boolean; children: React.ReactElement }) {
  const { open, setOpen } = useDropdownContext();
  const props = { onClick: () => setOpen(!open) };
  return asChild ? React.cloneElement(children, props) : <button {...props}>{children}</button>;
}

function DropdownMenuContent({
  className,
  children,
  align = "start",
}: React.HTMLAttributes<HTMLDivElement> & { align?: "start" | "center" | "end"; forceMount?: boolean }) {
  const { open, setOpen } = useDropdownContext();
  if (!open) return null;
  const alignmentClassName =
    align === "end" ? "right-0" : align === "center" ? "left-1/2 -translate-x-1/2" : "left-0";
  return (
    <div
      className={cn(
        "absolute top-full mt-2 z-50 min-w-48 rounded-md border bg-white p-1 shadow-lg",
        alignmentClassName,
        className
      )}
      onMouseLeave={() => setOpen(false)}
    >
      <div className="w-full">{children}</div>
    </div>
  );
}

const DropdownMenuLabel = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("px-2 py-1.5 text-sm font-semibold", className)} {...props} />
);

const DropdownMenuSeparator = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />
);

const DropdownMenuItem = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn("flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-muted", className)}
      {...props}
    />
  )
);
DropdownMenuItem.displayName = "DropdownMenuItem";

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
};
