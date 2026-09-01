import React from "react";
import { Info as InfoIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "./ui/dialog";
import { VisuallyHidden } from "./ui/visually-hidden";
import { About } from "./About";

interface InfoProps {
    isCollapsed: boolean;
}

const Info = React.forwardRef<HTMLButtonElement, InfoProps>(({ isCollapsed }, ref) => {
  return (
    <Dialog aria-describedby={undefined}>
      <DialogTrigger asChild>
        <button 
          ref={ref} 
          className={`flex cursor-pointer items-center justify-center border-none transition-colors ${
            isCollapsed 
              ? "h-10 w-10 rounded-xl bg-transparent text-slate-500 hover:bg-white hover:text-slate-900"
              : "mt-1 h-9 w-full rounded-xl px-3 text-[12px] font-semibold text-slate-600 hover:bg-white hover:text-slate-950"
          }`}
          title="About Free Meet Notes"
        >
          <InfoIcon className={isCollapsed ? "h-[18px] w-[18px]" : "h-4 w-4"} />
          {!isCollapsed && (
            <span className="ml-2">About</span>
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

Info.displayName = "About";

export default Info;
