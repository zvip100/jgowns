import { Inbox } from "lucide-react";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

type AdminEmptyStateProps = {
  title: string;
  description: string;
};

export function AdminEmptyState({ title, description }: AdminEmptyStateProps) {
  return (
    // Square, matching AdminTable: this stands in for the table in the same slot.
    <Empty className="surface-panel hairline py-14">
      <EmptyHeader>
        <EmptyMedia>
          <Inbox
            className="size-10 text-(--accent-deep)"
            strokeWidth={1.5}
            aria-hidden
          />
        </EmptyMedia>
        <EmptyTitle className="font-display text-xl text-(--ink)">
          {title}
        </EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
