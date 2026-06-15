import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

/** Returns the first value when a search param is a string or repeated key array. */
export function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

type BlurImageProps =
  | { placeholder: "blur"; blurDataURL: string }
  | Record<string, never>;

/** Spreads next/image blur placeholder props when a blur data URL exists. */
export function blurProps(blur: string | undefined): BlurImageProps {
  if (!blur) return {};
  return { placeholder: "blur", blurDataURL: blur };
}

/** FormData keys for image slot `index` — the contract between the listing form and the sell actions. */
export function imageSlotFormKeys(index: number): {
  file: string;
  existingUrl: string;
  blur: string;
} {
  return {
    file: `image_file_${index}`,
    existingUrl: `existing_url_${index}`,
    blur: `blur_${index}`,
  };
}
