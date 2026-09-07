import type { ReactNode } from "react";

type AdminSectionHeadingProps = {
  children: ReactNode;
  id?: string;
};

/** The `<h2>` every admin detail and panel section is titled with. */
export function AdminSectionHeading({ children, id }: AdminSectionHeadingProps) {
  return (
    <h2 id={id} className="font-display text-lg text-(--ink)">
      {children}
    </h2>
  );
}
