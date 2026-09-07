"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

import { TextInputField } from "@/components/form/TextInputField";
import { ACCEPTED_LISTING_IMAGE_TYPES } from "@/lib/types";

/**
 * The picker plus preview inside the add and replace dialogs. The seller-side
 * dropzone is a three-slot grid built for the listing form; a dialog needs one
 * control, not that component.
 */
type AdminImageFileFieldProps = {
  id: string;
  label: string;
  file: File | null;
  error?: string;
  disabled?: boolean;
  onSelect: (file: File | null) => void;
};

export function AdminImageFileField({
  id,
  label,
  file,
  error,
  disabled,
  onSelect,
}: AdminImageFileFieldProps) {
  const [preview, setPreview] = useState<string | null>(null);

  // Created in an effect, never during render, and revoked on every value
  // change as well as on unmount, or each pick leaks its object URL.
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="flex flex-col gap-3">
      <TextInputField
        id={id}
        label={label}
        type="file"
        accept={ACCEPTED_LISTING_IMAGE_TYPES.join(",")}
        disabled={disabled}
        error={error}
        onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
      />
      {preview && (
        <div className="relative aspect-3/4 w-28 overflow-hidden rounded-lg border border-(--line) bg-[#eadfce]/60">
          <Image
            src={preview}
            alt="Selected photo"
            fill
            sizes="112px"
            // A blob: URL has nothing for the optimizer to fetch.
            unoptimized
            className="object-cover"
          />
        </div>
      )}
    </div>
  );
}
