'use client';

import { FormField, type FormFieldProps } from '@/components/form/FormField';
import {
  FORM_CONTROL_CLASS,
  FORM_CONTROL_QUIET_INVALID_CLASS,
} from '@/components/form/constants';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type TextInputFieldProps = Omit<FormFieldProps, 'children'> &
  Omit<React.ComponentProps<typeof Input>, 'id'> & {
    id: string;
    inputClassName?: string;
  };

export function TextInputField({
  id,
  label,
  required,
  description,
  error,
  invalid,
  disabled,
  className,
  inputClassName,
  ...inputProps
}: TextInputFieldProps) {
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
      <Input
        id={id}
        disabled={disabled}
        aria-invalid={invalid || Boolean(error) || undefined}
        className={cn(
          FORM_CONTROL_CLASS,
          FORM_CONTROL_QUIET_INVALID_CLASS,
          inputClassName,
        )}
        {...inputProps}
      />
    </FormField>
  );
}
