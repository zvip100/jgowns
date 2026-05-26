'use client';

import type { RefObject } from 'react';
import Image from 'next/image';
import { Loader2, X } from 'lucide-react';
import { FormField } from '@/components/form/FormField';
import { FORM_FILE_INPUT_CLASS } from '@/components/form/constants';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

type ListingPhotoFieldProps = {
  fileInputRef: RefObject<HTMLInputElement | null>;
  preview: string | null;
  imageOptimizing: boolean;
  imageOptimizeError: string;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
};

export function ListingPhotoField({
  fileInputRef,
  preview,
  imageOptimizing,
  imageOptimizeError,
  onFileChange,
  onClear,
}: ListingPhotoFieldProps) {
  return (
    <FormField id="photo" label="Photo" required>
      <Input
        id="photo"
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onFileChange}
        className={FORM_FILE_INPUT_CLASS}
      />
      {preview && (
        <div className="mt-2">
          <div className="relative w-48">
            {imageOptimizing && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-background/80 px-3 text-center backdrop-blur-sm">
                <Loader2
                  className="size-8 shrink-0 animate-spin text-(--accent-deep)"
                  aria-hidden
                />
                <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Optimizing image…
                </span>
              </div>
            )}
            <Image
              src={preview}
              alt="Preview"
              width={192}
              height={256}
              sizes="192px"
              unoptimized
              className="h-64 w-48 rounded-2xl border border-border object-cover shadow-sm"
            />
            <Button
              type="button"
              variant="secondary"
              size="icon-sm"
              onClick={onClear}
              aria-label="Remove image"
              className="absolute -right-2 -top-2 rounded-full border border-border bg-background text-foreground shadow-lg ring-1 ring-black/5 hover:bg-muted"
            >
              <X />
            </Button>
          </div>
          {imageOptimizeError && (
            <FieldError className="mt-2 max-w-xs">
              {imageOptimizeError}
            </FieldError>
          )}
        </div>
      )}
    </FormField>
  );
}
