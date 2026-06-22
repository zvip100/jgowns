import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { z } from "zod"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Strips everything but digits from a phone string (used to filter phone inputs as you type). */
export function digitsOnlyPhone(value: string | null | undefined): string {
  return value ? value.replace(/\D/g, "") : "";
}

/**
 * Optional phone field shared by the auth and listing forms. Blank → undefined; otherwise the
 * value may contain only digits and common formatting (spaces, + ( ) - .), is normalized to a
 * digits-only string of 7–15 digits, and anything else (letters, etc.) is rejected.
 */
export const optionalPhoneSchema = z.preprocess(
  (val) => {
    if (typeof val !== "string") return undefined;
    const trimmed = val.trim();
    return trimmed === "" ? undefined : trimmed;
  },
  z
    .string()
    .regex(/^[\d\s()+.-]+$/)
    .transform(digitsOnlyPhone)
    .refine((digits) => digits.length >= 7 && digits.length <= 15)
    .optional(),
);

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
