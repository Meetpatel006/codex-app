"use client";

import { ReactLenis, useLenis } from "lenis/react";
import { useEffect } from "react";

export function LenisScroll({ children }: { children: React.ReactNode }) {
  return (
    <ReactLenis root options={{ lerp: 0.1, duration: 1.5, smoothWheel: true }}>
      {children}
      <AnchorScroll />
    </ReactLenis>
  );
}

function AnchorScroll() {
  const lenis = useLenis();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");

      if (anchor && anchor.href.includes("#")) {
        const hash = anchor.href.split("#")[1];
        const element = document.getElementById(hash);

        if (element) {
          e.preventDefault();
          lenis?.scrollTo(element, { offset: -70 });
        }
      }
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [lenis]);

  return null;
}