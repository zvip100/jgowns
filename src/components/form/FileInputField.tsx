'use client';

import { FormField, type FormFieldProps } from '@/components/form/FormField';
import { FORM_FILE_INPUT_CLASS } from '@/components/form/constants';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type FileInputFieldProps = Omit<FormFieldProps, 'children'> &
  Omit<React.ComponentProps<typeof Input>, 'id' | 'type'> & {
    id: string;
    inputClassName?: string;
  };

export function FileInputField({
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
}: FileInputFieldProps) {
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
        type="file"
        disabled={disabled}
        aria-invalid={invalid || Boolean(error) || undefined}
        className={cn(FORM_FILE_INPUT_CLASS, inputClassName)}
        {...inputProps}
      />
    </FormField>
  );
}
