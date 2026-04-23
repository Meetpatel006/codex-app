"use client";

import { useRef } from "react";
import Image from "next/image";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { GithubIcon } from "@/components/icons";
import { DitheringShader } from "@/components/ui/dithering-shader";
import { HoverButton } from "@/components/ui/hover-button";
import heroChatImage from "@/public/01-chat-en-website-blue-iphone-1284x2778.png";

export function HeroSection() {
  const containerRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const subheadingRef = useRef<HTMLHeadingElement>(null);
  const descRef = useRef<HTMLDivElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!headingRef.current || !subheadingRef.current || !descRef.current || !phoneRef.current || !ctaRef.current) return;

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    tl.from(headingRef.current, {
      y: 80,
      opacity: 0,
      duration: 1,
      delay: 0.2,
    })
      .from(
        subheadingRef.current,
        {
          y: 60,
          opacity: 0,
          duration: 0.9,
        },
        "-=0.6"
      )
      .from(
        descRef.current,
        {
          y: 40,
          opacity: 0,
          duration: 0.8,
        },
        "-=0.5"
      )
      .from(
        phoneRef.current,
        {
          y: 60,
          opacity: 0,
          scale: 0.9,
          duration: 1,
          ease: "back.out(1.2)",
        },
        "-=0.6"
      )
      .from(
        Array.from(ctaRef.current.children),
        {
          y: 30,
          opacity: 0,
          duration: 0.6,
          stagger: 0.15,
        },
        "-=0.4"
      );

  }, { scope: containerRef });

  return (
    <section ref={containerRef} className="relative w-full overflow-hidden bg-white">
      <div className="pointer-events-none absolute inset-0 z-0 opacity-30">
        <DitheringShader
          className="h-full w-full"
          width={1920}
          height={1080}
          shape="wave"
          type="8x8"
          colorBack="#ffffff"
          colorFront="#1863dc"
          pxSize={3}
          speed={0.55}
          style={{ width: "100%", height: "100%" }}
        />
      </div>

      <div className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(102deg,rgba(255,255,255,0.1)_0%,rgba(255,255,255,0.4)_30%,rgba(255,255,255,0.4)_70%,rgba(255,255,255,0.1)_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-[90vh] max-w-[1400px] flex-col px-8 pt-24 pb-20 md:px-12 md:pt-32 md:pb-32 lg:px-16">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div className="flex flex-col gap-8 -mt-10">
            <div ref={descRef} className="flex flex-col gap-6">
<h1
                ref={headingRef}
                className="font-serif text-[72px] font-normal leading-[1.00] tracking-[-1.44px] text-[#000000] md:text-[clamp(48px,6vw,72px)] lg:text-[72px]"
              >
                Your AI coding companion
              </h1>

              <h2
                ref={subheadingRef}
                className="text-[36px] font-normal leading-[1.20] tracking-[-0.32px] text-[#000000] md:text-[32px]"
              >
                Now on mobile
              </h2>

              <p className="max-w-lg text-[18px] leading-[1.40] text-[#212121]">
                AI coding assistant that runs locally on your desktop. 
                Now take it with you on your mobile device.
              </p>
            </div>

            <div ref={ctaRef} className="flex flex-wrap gap-3">
              <a
                href="#"
                className="rounded-3xl bg-blue-500 px-6 py-3 text-[15px] font-normal text-white transition-colors duration-200 hover:bg-blue-600 flex items-center gap-2"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download APK
              </a>
              <HoverButton className="px-5 py-3 text-[15px] font-normal text-black flex items-center gap-2">
                <GithubIcon className="size-5" />
                Coming Soon
              </HoverButton>
            </div>
          </div>

          <div ref={phoneRef} className="relative flex items-center justify-center">
            <div className="relative h-[500px] w-[280px] md:h-[600px] md:w-[340px] lg:h-[700px] lg:w-[400px]">
              <Image
                src={heroChatImage}
                alt="Codex App Interface"
                fill
                sizes="(max-width: 768px) 280px, (max-width: 1024px) 340px, 400px"
                className="rounded-[18px] object-cover"
                priority
              />
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-[150px] bg-gradient-to-t from-white to-transparent" />
    </section>
  );
}
