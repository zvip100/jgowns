"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Crop } from "lucide-react";

import { FormField } from "@/components/form/FormField";
import { Button } from "@/components/ui/button";

/**
 * The confirm dialog's view of the photo the studio exported, with a way back
 * into the studio. The pick and every edit happen in the studio itself.
 */
type AdminImageFileFieldProps = {
  id: string;
  label: string;
  file: File | null;
  error?: string;
  disabled?: boolean;
  onChange: () => void;
};

export function AdminImageFileField({
  id,
  label,
  file,
  error,
  disabled,
  onChange,
}: AdminImageFileFieldProps) {
  const [preview, setPreview] = useState<string | null>(null);

  // Created in an effect, never during render, and revoked on every value
  // change as well as on unmount, or each export leaks its object URL.
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
    <FormField id={id} label={label} error={error} disabled={disabled}>
      <div className="flex items-end gap-3">
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={onChange}
          className="rounded-full"
        >
          <Crop data-icon="inline-start" />
          Change photo
        </Button>
      </div>
    </FormField>
  );
}
