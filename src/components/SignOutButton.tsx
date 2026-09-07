import { signOut } from "@/lib/actions/auth";

import type { ReactNode } from "react";

type SignOutButtonProps = {
  className?: string;
  /** Custom trigger content, e.g. an icon. Defaults to the "Sign Out" label. */
  children?: ReactNode;
  /** Required when `children` renders no text (icon-only triggers). */
  ariaLabel?: string;
};

export default function SignOutButton({
  className,
  children,
  ariaLabel,
}: SignOutButtonProps) {
  return (
    <form action={signOut} className="contents">
      <button type="submit" className={className} aria-label={ariaLabel}>
        {children ?? "Sign Out"}
      </button>
    </form>
  );
}
