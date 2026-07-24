'use client';

import type { ReactNode } from 'react';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/components/ui/field';
import { FORM_LABEL_CLASS } from '@/components/form/constants';
import { cn } from '@/lib/utils';

export type FormFieldProps = {
  id: string;
  label: string;
  required?: boolean;
  description?: string;
  error?: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
};

export function FormField({
  id,
  label,
  required,
  description,
  error,
  invalid,
  disabled,
  className,
  children,
}: FormFieldProps) {
  const showInvalid = invalid || Boolean(error);

  return (
    <Field
      data-invalid={showInvalid || undefined}
      data-disabled={disabled || undefined}
      // Keep the control text/label normal on invalid; only the FieldError below
      // stays red (it sets its own color). Overrides ui/field's group red text.
      className={cn('data-[invalid=true]:text-foreground', className)}
    >
      <FieldLabel htmlFor={id} className={FORM_LABEL_CLASS}>
        {label}
        {required ? ' *' : null}
      </FieldLabel>
      {children}
      {description ? (
        <FieldDescription>{description}</FieldDescription>
      ) : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
}
