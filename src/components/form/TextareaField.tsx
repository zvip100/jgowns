'use client';

import { FormField, type FormFieldProps } from '@/components/form/FormField';
import {
  FORM_CONTROL_CLASS,
  FORM_CONTROL_QUIET_INVALID_CLASS,
} from '@/components/form/constants';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type TextareaFieldProps = Omit<FormFieldProps, 'children'> &
  Omit<React.ComponentProps<typeof Textarea>, 'id'> & {
    id: string;
    textareaClassName?: string;
  };

export function TextareaField({
  id,
  label,
  required,
  description,
  error,
  invalid,
  disabled,
  className,
  textareaClassName,
  ...textareaProps
}: TextareaFieldProps) {
  return (
    <FormField
      id={id}
      label={label}
      required={required}
      description={description}
      error={error}
      invalid={invalid}
      disabled={disabled}
      className={className}
    >
      <Textarea
        id={id}
        disabled={disabled}
        aria-invalid={invalid || Boolean(error) || undefined}
        className={cn(
          FORM_CONTROL_CLASS,
          FORM_CONTROL_QUIET_INVALID_CLASS,
          textareaClassName,
        )}
        {...textareaProps}
      />
    </FormField>
  );
}
