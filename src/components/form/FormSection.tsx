'use client';

import type { ReactNode } from 'react';
import { FORM_LABEL_CLASS } from '@/components/form/constants';
import {
  FieldDescription,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field';

type FormSectionProps = {
  legend: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function FormSection({
  legend,
  description,
  children,
  className,
}: FormSectionProps) {
  return (
    <FieldSet className={className}>
      <FieldLegend variant="label" className={FORM_LABEL_CLASS}>
        {legend}
      </FieldLegend>
      {description ? (
        <FieldDescription>{description}</FieldDescription>
      ) : null}
      {children}
    </FieldSet>
  );
}
