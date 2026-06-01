export const FORM_LABEL_CLASS =
  'text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-(--muted-ink)';

export const FORM_CONTROL_CLASS = 'bg-card';

export const FORM_SELECT_TRIGGER_CLASS = 'h-8 w-full bg-card';

export const FORM_FIELD_PAIR_GRID_CLASS =
  'grid grid-cols-1 gap-5 sm:grid-cols-2';

export const FORM_FILE_INPUT_CLASS =
  'h-auto max-w-xs cursor-pointer bg-card py-2 file:mr-3 file:cursor-pointer file:rounded-full file:border file:border-input file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:uppercase file:tracking-widest file:text-secondary-foreground';

export type SelectOption = { value: string; label: string };

export function toSelectOptions(xs: readonly string[]): SelectOption[] {
  return xs.map((x) => ({ value: x, label: x }));
}
