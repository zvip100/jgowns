'use client';

import { CONTACT_METHODS, CONTACT_METHOD_LABELS } from '@/lib/types';
import { FORM_LABEL_CLASS } from '@/components/form/constants';
import { CHECKBOX_GOLD_CLASS } from '@/lib/styles';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

import type { ContactMethod } from '@/lib/types';

type ContactMethodsFieldProps = {
  value: ContactMethod[];
  onToggle: (method: ContactMethod, checked: boolean) => void;
  /** A method only makes sense with a phone number to act on. */
  disabled?: boolean;
};

/** Shared by the seller listing form and the admin edit form. */
export function ContactMethodsField({
  value,
  onToggle,
  disabled = false,
}: ContactMethodsFieldProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <span className={FORM_LABEL_CLASS}>Buyers can</span>
      {CONTACT_METHODS.map((method) => (
        <div key={method} className="flex items-center gap-2">
          <Checkbox
            id={`contact-method-${method}`}
            checked={value.includes(method)}
            disabled={disabled}
            className={CHECKBOX_GOLD_CLASS}
            onCheckedChange={(checked) => onToggle(method, checked === true)}
          />
          <Label htmlFor={`contact-method-${method}`} className="font-normal">
            {CONTACT_METHOD_LABELS[method]}
          </Label>
        </div>
      ))}
    </div>
  );
}
