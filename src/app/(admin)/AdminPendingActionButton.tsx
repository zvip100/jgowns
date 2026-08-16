"use client";

import {
  Ban,
  CheckCircle2,
  ImageOff,
  LifeBuoy,
  LogOut,
  RotateCcw,
  ShoppingBag,
  Trash2,
  UserCheck,
} from "lucide-react";

import ConfirmActionButton from "@/components/ConfirmActionButton";

import {
  ADMIN_BACKEND_PENDING_NOTE,
  adminActionPending,
} from "./admin-pending";

import type { LucideIcon } from "lucide-react";

/**
 * Icons are looked up by key, never passed in: a Lucide component crossing the
 * Server → Client boundary throws "Functions cannot be passed directly to
 * Client Components", which took the whole page down via the error boundary.
 */
export const ADMIN_ACTION_ICONS = {
  ban: Ban,
  restore: RotateCcw,
  markSold: ShoppingBag,
  reactivate: CheckCircle2,
  removeImage: ImageOff,
  unban: UserCheck,
  signOut: LogOut,
  delete: Trash2,
  rescue: LifeBuoy,
} satisfies Record<string, LucideIcon>;

export type AdminActionIcon = keyof typeof ADMIN_ACTION_ICONS;

const TRIGGER_CLASS = {
  default:
    "inline-flex h-9 items-center gap-1.5 rounded-full border border-[#e0cfb6] bg-white/70 px-3 text-xs font-semibold text-(--ink) hover:bg-white",
  compact:
    "inline-flex h-8 items-center gap-1 rounded-full border border-[#e0cfb6] bg-white/70 px-2.5 text-xs font-semibold text-(--ink) hover:bg-white",
  icon: "inline-flex size-8 items-center justify-center rounded-full border border-[#e0cfb6] bg-white/70 text-(--muted-ink) hover:bg-white hover:text-(--ink)",
} as const;

type AdminPendingActionButtonProps = {
  title: string;
  description: string;
  confirmLabel: string;
  ariaLabel: string;
  buttonLabel?: string;
  icon: AdminActionIcon;
  confirmVariant?: "default" | "destructive";
  /** Trigger footprint. `icon` renders an icon-only button (per-size, per-image). */
  size?: keyof typeof TRIGGER_CLASS;
};

/** Confirm dialog that always surfaces the Phase 1 "backend pending" notice inline. */
export function AdminPendingActionButton({
  title,
  description,
  confirmLabel,
  ariaLabel,
  buttonLabel,
  icon,
  confirmVariant = "default",
  size = "default",
}: AdminPendingActionButtonProps) {
  return (
    <ConfirmActionButton
      title={title}
      description={`${description} ${ADMIN_BACKEND_PENDING_NOTE}`}
      confirmLabel={confirmLabel}
      pendingLabel="Working..."
      ariaLabel={ariaLabel}
      buttonLabel={buttonLabel}
      icon={ADMIN_ACTION_ICONS[icon]}
      confirmVariant={confirmVariant}
      triggerClassName={TRIGGER_CLASS[size]}
      triggerStyle={size === "icon" ? "inline-icon" : "button"}
      onConfirm={adminActionPending}
    />
  );
}
