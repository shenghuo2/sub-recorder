"use client";

import Image from "next/image";

export function AppLogo({ size = 36 }: { size?: number; animate?: boolean }) {
  return (
    <Image
      src="/money_with_wings.gif"
      alt="Sub Recorder"
      width={size}
      height={size}
      unoptimized
      priority
    />
  );
}
