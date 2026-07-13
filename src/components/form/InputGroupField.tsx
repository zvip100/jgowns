'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { FormField, type FormFieldProps } from '@/components/form/FormField';
import { FORM_CONTROL_CLASS } from '@/components/form/constants';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group';
import { cn } from '@/lib/utils';

type InputGroupFieldProps = Omit<FormFieldProps, 'children'> &
  Omit<React.ComponentProps<typeof InputGroupInput>, 'id'> & {
    id: string;
    leading?: ReactNode;
    groupClassName?: string;
    /** Renders a trailing clear (✕) button while the field has a value. */
    onClear?: () => void;
  };

export function InputGroupField({
  id,
  label,
  required,
  description,
  error,
  invalid,
  disabled,
  className,
  leading,
  groupClassName,
  onClear,
  ...inputProps
}: InputGroupFieldProps) {
  const showInvalid = invalid || Boolean(error);
  const showClear =
    Boolean(onClear) && inputProps.value != null && inputProps.value !== '';

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
      <InputGroup className={cn(FORM_CONTROL_CLASS, groupClassName)}>
        {leading != null ? (
          <InputGroupAddon>
            {typeof leading === 'string' ? (
              <InputGroupText className="font-semibold text-foreground">
                {leading}
              </InputGroupText>
            ) : (
              leading
            )}
          </InputGroupAddon>
        ) : null}
        <InputGroupInput
          id={id}
          disabled={disabled}
          aria-invalid={showInvalid || undefined}
          {...inputProps}
        />
        {showClear ? (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              type="button"
              size="icon-xs"
              aria-label={`Clear ${label.toLowerCase()}`}
              tabIndex={-1}
              disabled={disabled}
              onClick={onClear}
            >
              <X />
            </InputGroupButton>
          </InputGroupAddon>
        ) : null}
      </InputGroup>
    </FormField>
  );
}
