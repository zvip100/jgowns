'use client';

import type { ReactNode } from 'react';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/components/ui/field';
import { FORM_LABEL_CLASS } from '@/components/form/constants';

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
      className={className}
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
