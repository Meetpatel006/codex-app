// This is file of your component

// You can use any dependencies from npm; we import them automatically in package.json
'use client';
import { ArrowRight, LucideIcon } from 'lucide-react';

export  function FlowButton({ text = "Modern Button", icon: Icon }: { text?: string; icon?: LucideIcon }) {
  return (
    <button className="group relative flex items-center gap-1 overflow-hidden rounded-[100px] border-[1.5px] border-blue-500 bg-blue-500 px-8 py-3 text-sm font-normal text-white cursor-pointer transition-all duration-[600ms] ease-[cubic-bezier(0.23,1,0.32,1)] hover:text-white hover:rounded-[12px] active:scale-[0.95]">
      <ArrowRight 
        className="absolute w-4 h-4 left-[-25%] stroke-white fill-none z-[9] group-hover:left-4 group-hover:stroke-white transition-all duration-[800ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]" 
      />

      <span className="relative z-[1] -translate-x-3 group-hover:translate-x-3 transition-all duration-[800ms] ease-out">
        {text}
      </span>

      <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-blue-500 rounded-[50%] opacity-0 group-hover:w-[220px] group-hover:h-[220px] group-hover:opacity-100 transition-all duration-[800ms] ease-[cubic-bezier(0.19,1,0.22,1)]"></span>

      <ArrowRight 
        className="absolute w-4 h-4 right-4 stroke-white fill-none z-[9] group-hover:right-[-25%] group-hover:stroke-white transition-all duration-[800ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]" 
      />
    </button>
  );
}
