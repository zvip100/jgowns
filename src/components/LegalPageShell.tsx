import type { ReactNode } from "react";

type LegalPageShellProps = {
  title: string;
  updatedAt: string;
  children: ReactNode;
};

export default function LegalPageShell({
  title,
  updatedAt,
  children,
}: LegalPageShellProps) {
  return (
    <article className="mx-auto w-full max-w-3xl">
      <header className="mb-10 border-b border-(--line) pb-6">
        <h1 className="font-display text-[2.1rem] text-(--ink) sm:text-[2.6rem]">
          {title}
        </h1>
        <p className="mt-3 text-sm text-(--muted-ink)">
          Last updated: {updatedAt}
        </p>
      </header>
      <div className="flex flex-col gap-9 leading-relaxed text-(--muted-ink)">
        {children}
      </div>
    </article>
  );
}
