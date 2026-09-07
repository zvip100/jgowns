import { Suspense } from "react";

type AdminResultCountProps = {
  countPromise: Promise<number>;
  noun: string;
  /** Only when adding an "s" is wrong. */
  pluralNoun?: string;
};

export function formatResultCount(
  count: number,
  noun: string,
  pluralNoun?: string,
): string {
  return `${count} ${count === 1 ? noun : (pluralNoun ?? `${noun}s`)}`;
}

/**
 * The one line of a list-page header that depends on the query, wrapped in its
 * own boundary so the title above it paints without waiting on the count.
 */
export function AdminResultCount({
  countPromise,
  noun,
  pluralNoun,
}: AdminResultCountProps) {
  const plural = pluralNoun ?? `${noun}s`;

  return (
    <Suspense fallback={`Counting ${plural}...`}>
      <ResolvedCount
        countPromise={countPromise}
        noun={noun}
        pluralNoun={plural}
      />
    </Suspense>
  );
}

type ResolvedCountProps = {
  countPromise: Promise<number>;
  noun: string;
  pluralNoun: string;
};

async function ResolvedCount({
  countPromise,
  noun,
  pluralNoun,
}: ResolvedCountProps): Promise<string> {
  const count = await countPromise;
  return formatResultCount(count, noun, pluralNoun);
}
