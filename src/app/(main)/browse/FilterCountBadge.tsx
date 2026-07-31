import { Badge } from "@/components/ui/badge";
import { FILTER_COUNT_BADGE_CLASS } from "@/lib/styles";

type FilterCountBadgeProps = { count: number };

export default function FilterCountBadge({ count }: FilterCountBadgeProps) {
  if (count <= 0) return null;
  return (
    <Badge
      variant="outline"
      className={`${FILTER_COUNT_BADGE_CLASS} px-2 py-0 text-[0.66rem] leading-5`}
    >
      {count}
    </Badge>
  );
}
