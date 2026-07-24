export const FORM_LABEL_CLASS =
  'text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-(--muted-ink)';

export const FORM_CONTROL_CLASS = 'bg-card';

/** Suppresses the shadcn destructive border/ring on an invalid control so a
 * field error reads as the message below the field, not a loud red outline.
 * `aria-invalid` stays on the control for accessibility. The focus-visible ring
 * is re-asserted (important) so a focused invalid control still shows a normal
 * (non-red) focus indicator — otherwise `ring-0` would swallow it too. For
 * controls that carry `aria-invalid` on themselves (Input, Textarea,
 * SelectTrigger). */
export const FORM_CONTROL_QUIET_INVALID_CLASS =
  'aria-invalid:border-input aria-invalid:ring-0 focus-visible:border-ring! focus-visible:ring-3! focus-visible:ring-ring/50!';

/** Same intent for a wrapper that styles itself from an invalid descendant via
 * `has-[…]` (the InputGroup container). */
export const FORM_GROUP_QUIET_INVALID_CLASS =
  'has-[[data-slot][aria-invalid=true]]:border-input has-[[data-slot][aria-invalid=true]]:ring-0 has-[[data-slot=input-group-control]:focus-visible]:border-ring! has-[[data-slot=input-group-control]:focus-visible]:ring-3! has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50!';

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
