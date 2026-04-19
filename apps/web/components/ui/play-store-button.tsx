import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PlayStoreButtonProps = React.ComponentProps<typeof Button>;

export function PlayStoreButton({
  className,
  ...props
}: Omit<PlayStoreButtonProps, "children">) {
  return (
    <Button
      className={cn(
        "h-auto min-h-[52px] gap-2 rounded-[22px] border border-[#e5e7eb] bg-white px-6 py-3 transition-all duration-200 hover:border-[#1863dc]",
        className
      )}
      variant="ghost"
      {...props}
    >
      <PlayStoreIcon className="size-5" fill="currentColor" />
      <div className="flex flex-col items-start justify-center">
        <span className="text-[10px] font-normal uppercase tracking-wider text-[#93939f]">
          GET IT ON
        </span>
        <p className="text-[15px] font-normal text-[#000000]">Google Play</p>
      </div>
    </Button>
  );
}

function PlayStoreIcon({
  fill = "currentColor",
  ...props
}: React.ComponentProps<"svg">) {
  return (
    <svg viewBox="0 0 24 24" fill={fill} {...props}>
      <path d="m21.762,9.942L4.67.378c-.721-.466-1.635-.504-2.393-.099-.768.411-1.246,1.208-1.246,2.08v19.282c0,.872.477,1.668,1.246,2.079.755.404,1.668.37,2.393-.098l17.092-9.564c.756-.423,1.207-1.192,1.207-2.058s-.451-1.635-1.207-2.058Zm-5.746-1.413l-2.36,2.36L5.302,2.534l10.714,5.995ZM2.604,21.906V2.094l9.941,9.906L2.604,21.906Zm2.698-.439l8.355-8.355,2.36,2.36-10.714,5.995Zm15.692-8.78l-3.552,1.987-2.674-2.674,2.674-2.674,3.552,1.987c.363.203.402.548.402.686s-.039.483-.402.686Z" />
    </svg>
  );
}