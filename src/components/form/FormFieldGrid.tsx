import type { ReactNode } from 'react';
import { FORM_FIELD_PAIR_GRID_CLASS } from '@/components/form/constants';
import { cn } from '@/lib/utils';

type FormFieldGridProps = {
  children: ReactNode;
  className?: string;
};

export function FormFieldGrid({ children, className }: FormFieldGridProps) {
  return (
    <div className={cn(FORM_FIELD_PAIR_GRID_CLASS, className)}>{children}</div>
  );
}
