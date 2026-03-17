"use client";

import Image from "next/image";

export function AppLogo({ size = 36, animate = true }: { size?: number; animate?: boolean }) {
  return (
    <Image
      src="/app-icon.svg"
      alt="Sub Recorder"
      width={size}
      height={size}
      className={animate ? "animate-svg-color" : ""}
      priority
    />
  );
}
