import { ShieldX } from "lucide-react";

import NoticePanel from "@/components/NoticePanel";

import { AdminBackButton } from "./AdminBackButton";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page Not Found",
  description: "The page you're looking for doesn't exist.",
  robots: { index: false, follow: false },
};

/**
 * Only a signed-in admin reaches this: a missing record inside the admin tree.
 * The layout's claim guard throws from the layout itself, which escapes this
 * boundary, so anyone without the claim gets the root 404 instead. Actions stay
 * inside the admin surface for that reason.
 */
export default function AdminNotFound() {
  return (
    <NoticePanel
      icon={ShieldX}
      title="Page not found"
      description="This admin page or record no longer exists."
      primaryAction={<AdminBackButton />}
      secondaryHref="/admin"
      secondaryLinkLabel="Admin overview"
    />
  );
}
