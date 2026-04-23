"use client";

import { cn } from "@/lib/utils";

function FeatureRow({ title, description, reverse = false, screenshots = [] }: { title: string; description: string; reverse?: boolean; screenshots?: string[] }) {
  return (
    <div className={cn(
      "flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-16",
      reverse && "lg:flex-row-reverse"
    )}>
      <div className="flex-1">
        <h3 className="text-[28px] font-normal leading-[1.2] tracking-[-0.02em] text-[#000000] md:text-[36px]">
          {title}
        </h3>
        <p className="mt-4 text-lg leading-[1.5] text-[#93939f]">
          {description}
        </p>
      </div>

      <div className="flex-1">
        {screenshots.length > 0 ? (
          <div className="relative h-full w-full overflow-hidden rounded-[22px] bg-[linear-gradient(140deg,#446fe3_0%,#6f86e9_45%,#f4b3cc_100%)] p-3 shadow-[0_20px_55px_rgba(20,40,90,0.22)]">
            <div className="flex items-end gap-2 md:gap-3">
              {screenshots.map((src, index) => (
                <div key={index} className="relative min-w-0 flex-1">
                  <img
                    src={src}
                    alt={`Screenshot ${index + 1}`}
                    className="h-auto w-full rounded-xl object-contain"
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function FeaturesSection() {
  return (
    <section id="features" className="bg-white pt-16 pb-8 md:pt-20 md:pb-10">
      <div className="mx-auto max-w-[1400px] px-8 md:px-12 lg:px-16">
        <div className="mb-16 flex flex-col items-center text-center">
          <h2 className="text-[40px] font-normal leading-[1.0] tracking-[-0.02em] text-[#000000] md:text-[56px]">
            Everything you need
          </h2>
          <p className="mt-4 max-w-2xl text-lg text-[#93939f]">
            Connect your mobile to Codex and take your coding workflow anywhere.
          </p>
        </div>


        <div className="mt-24">

          <div className="flex flex-col gap-20">
            <FeatureRow 
              title="Connect in Seconds"
              description="Open the app, scan the QR code or enter code manually, and start coding instantly. Your development environment is ready on your mobile."
              screenshots={[
                "/01-scan-en-website-blue-iphone-1284x2778.png",
                "/02-connecting-en-website-blue-iphone-1284x2778.png",
                "/03-ready-en-website-blue-iphone-1284x2778.png",
              ]}
            />

            <FeatureRow 
              title="Switch Projects & Models"
              description="Chat with any project. Choose different AI models with varying thinking levels. Navigate between projects effortlessly and track your usage in real-time."
              reverse={true}
              screenshots={[
                "/01-chat-en-website-blue-iphone-1284x2778.png",
                "/01-new-screenshot-en-website-blue-iphone-1284x2778.png",
                "/02-sidebar-en-website-blue-iphone-1284x2778.png",
              ]}
            />

            <FeatureRow 
              title="Git & Branch Management"
              description="Monitor all git activity. View branches, create new branches, and make commits directly from your mobile. Stay connected to your repo anywhere."
              screenshots={[
                "/01-git-en-website-blue-iphone-1284x2778.png",
                "/02-commit-en-website-blue-iphone-1284x2778.png",
                "/03-branch-en-website-blue-iphone-1284x2778.png",
              ]}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
