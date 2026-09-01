import React from "react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "./ui/dialog";
import { VisuallyHidden } from "./ui/visually-hidden";
import { About } from "./About";

interface LogoProps {
    isCollapsed: boolean;
}

const Logo = React.forwardRef<HTMLButtonElement, LogoProps>(({ isCollapsed }, ref) => {
  const mark = (
    <span className="grid h-9 w-9 shrink-0 grid-cols-3 items-end gap-[3px] rounded-xl bg-slate-950 p-[9px] shadow-sm" aria-hidden="true">
      <span className="h-2 rounded-full bg-blue-400" />
      <span className="h-5 rounded-full bg-blue-500" />
      <span className="h-3.5 rounded-full bg-sky-300" />
    </span>
  );

  return (
    <Dialog aria-describedby={undefined}>
      <DialogTrigger asChild>
        <button
          ref={ref}
          className={`group flex items-center border-0 bg-transparent p-0 text-left ${isCollapsed ? 'justify-center' : 'gap-3'}`}
          aria-label="About Free Meet Notes"
        >
          {mark}
          {!isCollapsed && (
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-bold tracking-[-0.025em] text-slate-950">Free Meet Notes</span>
              <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">Private by default</span>
            </span>
          )}
        </button>
      </DialogTrigger>
      <DialogContent>
        <VisuallyHidden>
          <DialogTitle>About Free Meet Notes</DialogTitle>
        </VisuallyHidden>
        <About />
      </DialogContent>
    </Dialog>
  );
});

Logo.displayName = "Logo";

export default Logo;
