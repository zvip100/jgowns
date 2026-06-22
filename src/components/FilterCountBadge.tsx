import { Badge } from "@/components/ui/badge";

type FilterCountBadgeProps = { count: number };

export default function FilterCountBadge({ count }: FilterCountBadgeProps) {
  if (count <= 0) return null;
  return (
    <Badge
      variant="outline"
      className="rounded-full border-0 bg-[linear-gradient(180deg,#c49a68,#a67841)] px-2 py-0 text-[0.6rem] font-semibold leading-5 text-white shadow-[0_4px_12px_rgba(166,120,65,0.35)]"
    >
      {count}
    </Badge>
  );
}
