"use client";

import { useState } from "react";
import { ChevronDownIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

const qnaItems = [
  {
    question: "How does Portdex Mobile connect to my desktop?",
    answer:
      "Scan the QR code displayed by the Portdex bridge on your desktop. The connection is encrypted end-to-end using cryptographic key pairs stored securely on your device.",
  },
  {
    question: "Is my code sent to the cloud?",
    answer:
      "No. Portdex Mobile communicates directly with your local Portdex instance via an encrypted WebSocket connection. Your code never leaves your machines.",
  },
  {
    question: "What can I do on mobile that I can't do on desktop?",
    answer:
      "Mobile is designed for monitoring and approval workflows. You can review code changes, approve file modifications, and run commands while on the go. For complex editing, use the desktop app.",
  },
  {
    question: "Does it work offline?",
    answer:
      "You need an active connection to your desktop to communicate with Portdex. However, once paired, the app works over any network your phone and desktop share.",
  },
];

export function QnaSection() {
  const [openIndex, setOpenIndex] = useState(-1);

  return (
    <section id="faq" className="bg-white py-20 md:py-28">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-14 px-8 md:px-12 lg:grid-cols-[0.95fr_1.15fr] lg:items-center lg:gap-16 lg:px-16">
        <div className="flex flex-col">
          <h2 className="max-w-md text-[40px] font-normal leading-[1.0] tracking-[-0.02em] text-[#000000] md:text-[56px]">
            Questions
            <br />
            and answers
          </h2>

          <p className="mt-8 max-w-sm text-lg text-[#93939f]">
            We have answers to your questions about Codex Mobile.
          </p>
        </div>

        <div className="space-y-3">
          {qnaItems.map((item, index) => {
            const isOpen = openIndex === index;

            return (
              <div
                key={item.question}
                className={cn(
                  "cursor-pointer rounded-[22px] border border-[#f2f2f2] bg-white transition-all duration-200",
                   isOpen
                    ? "rounded-[22px] border border-[#e5e7eb] p-7"
                    : "p-5 hover:border-[#d9d9dd]"
                )}
                onClick={() => setOpenIndex(isOpen ? -1 : index)}
              >
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="text-lg font-normal text-[#000000] md:text-[20px]">
                    {item.question}
                  </span>
                  <ChevronDownIcon
                    className={cn(
                      "h-5 w-5 shrink-0 text-[#93939f] transition-transform duration-200",
                      isOpen ? "rotate-0" : "-rotate-90"
                    )}
                  />
                </div>

                <div
                  className={cn(
                    "overflow-hidden transition-all duration-200",
                    isOpen ? "mt-4" : "mt-0 hidden"
                  )}
                >
                  <p className="text-base text-[#93939f]">
                    {item.answer}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}