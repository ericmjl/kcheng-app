"use client";

import Image from "next/image";

/**
 * Q-tip: cheerful quokka avatar (WebP image).
 * Used in the Trip Assistant bubble, panel header, and home page hero.
 */
const AVATAR_ASPECT = 80 / 64; // portrait orientation

export function QuokkaAvatar({
  size = 40,
  className,
  "aria-hidden": ariaHidden = true,
}: {
  size?: number;
  className?: string;
  "aria-hidden"?: boolean;
}) {
  const height = Math.round(size * AVATAR_ASPECT);
  return (
    <Image
      src="/images/q-tip.webp"
      alt="Q-tip"
      width={size}
      height={height}
      className={className}
      aria-hidden={ariaHidden}
      {...(ariaHidden ? {} : { role: "img" as const })}
      sizes={`${size}px`}
    />
  );
}
