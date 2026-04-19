"use client";

import { GithubIcon } from "@/components/icons";
import { HoverButton } from "@/components/ui/hover-button";

export function CallToActionSection() {
  return (
    <section id="download" className="relative w-full overflow-hidden bg-white">
      <div className="relative z-10 mx-auto flex min-h-[80vh] max-w-[1400px] flex-col items-center justify-center px-8 py-20 md:px-12 md:py-32 lg:px-16">
        <div className="flex flex-col items-center text-center gap-8">
          <h2 className="text-[clamp(40px,5vw,72px)] font-normal leading-[1.0] tracking-[-0.02em] text-[#000000]">
            Your desktop codes.
            <br />
            <span className="text-[#93939f]">Your phone approves.</span>
          </h2>

<div className="mt-8 flex flex-wrap justify-center gap-4">
            <a
              href="#"
              className="rounded-3xl bg-blue-500 px-8 py-4 text-[16px] font-normal text-white transition-colors duration-200 hover:bg-blue-600 flex items-center gap-2"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download APK
            </a>
            <HoverButton className="px-8 py-4 text-[16px] font-normal text-black flex items-center gap-2">
              <GithubIcon className="size-5" />
              Coming Soon
            </HoverButton>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-[150px] bg-gradient-to-t from-white to-transparent" />
    </section>
  );
}