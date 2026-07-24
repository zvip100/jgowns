'use client';

import { FormField } from '@/components/form/FormField';
import {
  FORM_CONTROL_QUIET_INVALID_CLASS,
  FORM_SELECT_TRIGGER_CLASS,
  type SelectOption,
} from '@/components/form/constants';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export type { SelectOption } from '@/components/form/constants';
export { toSelectOptions } from '@/components/form/constants';

type SelectFieldProps = {
  id: string;
  label: string;
  placeholder: string;
  options: SelectOption[];
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  disabled?: boolean;
  description?: string;
  error?: string;
  invalid?: boolean;
  className?: string;
  triggerClassName?: string;
};

export function SelectField({
  id,
  label,
  placeholder,
  options,
  value,
  onChange,
  required,
  disabled,
  description,
  error,
  invalid,
  className,
  triggerClassName,
}: SelectFieldProps) {
  const showInvalid = invalid || Boolean(error);

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
      <Select
        value={value || undefined}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger
          id={id}
          aria-invalid={showInvalid || undefined}
          className={cn(
            FORM_SELECT_TRIGGER_CLASS,
            FORM_CONTROL_QUIET_INVALID_CLASS,
            triggerClassName,
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </FormField>
  );
}
