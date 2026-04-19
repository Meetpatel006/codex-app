"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import Link from "next/link";
import { RandomLetterSwapPingPong } from "@/components/ui/random-letter-swap";
import { FlowButton } from "@/components/ui/flow-button";
import { ArrowDown } from "lucide-react";

export function Navbar() {
  const headerRef = useRef<HTMLElement>(null);
  const logoRef = useRef<HTMLAnchorElement>(null);
  const navRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!headerRef.current || !logoRef.current || !navRef.current) return;

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    tl.from(headerRef.current, {
      y: -20,
      opacity: 0,
      duration: 0.6,
    })
      .from([logoRef.current, navRef.current], {
        x: -20,
        opacity: 0,
        duration: 0.5,
        stagger: 0.1,
      }, "-=0.3");
  }, { scope: headerRef });

  return (
    <header 
      ref={headerRef} 
      className="sticky top-0 left-0 right-0 z-50 w-full bg-transparent"
    >
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-8 py-4 md:px-12 lg:px-16 gap-4">
        <Link 
          ref={logoRef} 
          href="/" 
          className="flex items-center gap-2"
        >
          <span className="rounded-full bg-[#000000] px-6 py-3 text-[16px] font-normal text-white">
            <RandomLetterSwapPingPong label="Portdex" className="text-[16px] font-normal" />
          </span>
        </Link>

        <nav ref={navRef} className="hidden md:flex items-center justify-center flex-1 ">
          <div className="rounded-full bg-white border border-[#f2f2f2] px-6 py-3 flex items-center gap-3 ring-1 ring-gray-200 rounded-full p-1">
            <a href="#features" className="rounded-full px-4 py-1 text-[16px] font-normal text-[#000000] hover:bg-[#f2f2f2] transition-colors duration-200 block">
              <RandomLetterSwapPingPong label="Features" className="text-[16px] font-normal" />
            </a>
            <a href="#faq" className="rounded-full px-4 py-1 text-[16px] font-normal text-[#000000] hover:bg-[#f2f2f2] transition-colors duration-200 block">
              <RandomLetterSwapPingPong label="FAQ" className="text-[16px] font-normal" />
            </a>
            <a href="#download" className="rounded-full px-4 py-1 text-[16px] font-normal text-[#000000] hover:bg-[#f2f2f2] transition-colors duration-200 block">
              <RandomLetterSwapPingPong label="Download" className="text-[16px] font-normal" />
            </a>
          </div>
        </nav>
        <FlowButton text="Get it free" icon={ArrowDown} />
      </div>
    </header>
  );
}