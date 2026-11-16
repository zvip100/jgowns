import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { CHECKBOX_GOLD_CLASS } from '@/lib/styles';
import { cn } from '@/lib/utils';

type LabeledCheckboxProps = {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
};

export function LabeledCheckbox({
  id,
  label,
  checked,
  onCheckedChange,
  disabled,
  className,
}: LabeledCheckboxProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        className={CHECKBOX_GOLD_CLASS}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      <Label htmlFor={id} className="font-normal">
        {label}
      </Label>
    </div>
  );
}
