export const FORM_LABEL_CLASS =
  'text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-(--muted-ink)';

export const FORM_CONTROL_CLASS = 'bg-card';

/** Italic muted hint under a field (e.g. "One photo required"). */
export const FORM_HINT_CLASS =
  'text-[0.80rem] font-light italic tracking-wide text-muted-foreground/80';

export const FORM_SELECT_TRIGGER_CLASS = 'h-8 w-full bg-card';

export const FORM_FIELD_PAIR_GRID_CLASS =
  'grid grid-cols-1 gap-5 sm:grid-cols-2';

export type SelectOption = { value: string; label: string };

export function toSelectOptions(xs: readonly string[]): SelectOption[] {
  return xs.map((x) => ({ value: x, label: x }));
}
