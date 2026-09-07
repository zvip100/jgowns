"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { NOTICE_PANEL_PRIMARY_ACTION_CLASS } from "@/lib/styles";

/** Primary action for the admin 404: back to the last page that worked. */
export function AdminBackButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className={NOTICE_PANEL_PRIMARY_ACTION_CLASS}
    >
      <ArrowLeft className="size-3.5" aria-hidden />
      Go back
    </button>
  );
}
