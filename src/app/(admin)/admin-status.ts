import type { AdminListingStatus } from "./admin-types";
import type { PillTone } from "@/lib/styles";

export const ADMIN_STATUS_TONES: Record<AdminListingStatus, PillTone> = {
  active: "positive",
  sold: "sold",
  removed: "warning",
  pending_payment: "gold",
  suspended: "critical",
};

export const ADMIN_STATUS_LABELS: Record<AdminListingStatus, string> = {
  active: "Active",
  sold: "Sold",
  removed: "Removed",
  pending_payment: "Payment required",
  suspended: "Suspended",
};
