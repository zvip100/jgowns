'use client';

import { CONTACT_METHODS, CONTACT_METHOD_LABELS } from '@/lib/types';
import { FORM_LABEL_CLASS } from '@/components/form/constants';
import { LabeledCheckbox } from '@/components/form/LabeledCheckbox';

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
        <LabeledCheckbox
          key={method}
          id={`contact-method-${method}`}
          label={CONTACT_METHOD_LABELS[method]}
          checked={value.includes(method)}
          disabled={disabled}
          onCheckedChange={(checked) => onToggle(method, checked)}
        />
      ))}
    </div>
  );
}
