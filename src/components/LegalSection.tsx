import type { ReactNode } from "react";

type LegalSectionProps = {
  title: string;
  children: ReactNode;
};

export default function LegalSection({ title, children }: LegalSectionProps) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-xl text-(--ink) sm:text-2xl">{title}</h2>
      {children}
    </section>
  );
}
