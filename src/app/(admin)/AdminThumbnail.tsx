import { ImageIcon } from "lucide-react";
import Image from "next/image";

import { blurProps } from "@/lib/utils";

type AdminThumbnailProps = {
  src: string | null | undefined;
  blurDataURL?: string | null;
  alt: string;
  size?: number;
};

export function AdminThumbnail({
  src,
  blurDataURL,
  alt,
  size = 40,
}: AdminThumbnailProps) {
  if (!src) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-md bg-[#eadfce]/80 text-(--muted-ink)"
        style={{ width: size, height: size }}
        aria-hidden
      >
        <ImageIcon className="size-4" strokeWidth={1.5} />
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      // Phase 1 fixture photos are inline SVG data URIs, which the optimizer
      // cannot fetch. Real Supabase URLs still go through it.
      unoptimized={src.startsWith("data:")}
      className="shrink-0 rounded-md object-cover"
      style={{ width: size, height: size }}
      {...blurProps(blurDataURL ?? undefined)}
    />
  );
}
