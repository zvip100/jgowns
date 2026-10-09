"use client";

import { useState, useTransition } from "react";
import {
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ImageOff,
  ImagePlus,
  ImageUp,
  LifeBuoy,
  Loader2,
  RotateCcw,
  ScanFace,
  ShoppingBag,
  Trash2,
  UserCheck,
} from "lucide-react";

import ConfirmActionButton from "@/components/ConfirmActionButton";
import { SelectField } from "@/components/form/SelectField";
import { PhotoStudioDialog } from "@/components/photo-studio/PhotoStudioDialog";
import { TextareaField } from "@/components/form/TextareaField";
import { Checkbox } from "@/components/ui/checkbox";
import {
  adminAddListingImage,
  adminMarkListingSold,
  adminMarkSizeSold,
  adminMoveListingImage,
  adminReactivateListing,
  adminReactivateSize,
  adminRemoveListing,
  adminRemoveListingImage,
  adminReplaceListingImage,
  adminReprocessListingImage,
  adminRestoreListing,
  adminSuspendListing,
} from "@/lib/actions/admin/listings";
import { adminRescuePayment } from "@/lib/actions/admin/payments";
import {
  adminBanUser,
  adminDeleteUser,
  adminUnbanUser,
} from "@/lib/actions/admin/users";
import { exportEditedImage, UNREADABLE_PHOTO_ERROR } from "@/lib/image-upload";
import {
  MAX_SUSPENSION_NOTE_LENGTH,
  SUSPENSION_SLUGS,
  SUSPENSION_SLUG_LABELS,
} from "@/lib/suspension";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  listingImageFileSchema,
  suspendListingSchema,
} from "@/lib/validations/admin/listing-schema";

import { AdminImageFileField } from "./AdminImageFileField";
import { ADMIN_STATUS_LABELS } from "./admin-audit-labels";

import type { AdminListingStatus } from "@/lib/admin/types";
import type { PhotoStudioItem } from "@/lib/types";

/**
 * Every write on the admin surface, as confirm-gated leaves. Each imports its
 * server action directly rather than receiving it as a prop, matching the
 * seller-side buttons, so nothing crosses the Server to Client boundary.
 */

const TRIGGER_CLASS = {
  default:
    "inline-flex h-9 items-center gap-1.5 rounded-full border border-[#e0cfb6] bg-white/70 px-3 text-xs font-semibold text-(--ink) hover:bg-white",
  compact:
    "inline-flex h-8 items-center gap-1 rounded-full border border-[#e0cfb6] bg-white/70 px-2.5 text-xs font-semibold text-(--ink) hover:bg-white",
  icon: "inline-flex size-8 items-center justify-center rounded-full border border-[#e0cfb6] bg-white/70 text-(--muted-ink) hover:bg-white hover:text-(--ink)",
} as const;

const SLUG_OPTIONS = SUSPENSION_SLUGS.map((slug) => ({
  value: slug,
  label: SUSPENSION_SLUG_LABELS[slug],
}));

type SuspendValue = { slug: string; note: string };
type SuspendFieldErrors = { slug?: string; note?: string };

const EMPTY_SUSPEND_VALUE: SuspendValue = { slug: "", note: "" };

/** Routes each zod issue to the control it belongs to; first message wins. */
function suspendFieldErrors(
  issues: readonly { path: PropertyKey[]; message: string }[],
): SuspendFieldErrors {
  const errors: SuspendFieldErrors = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if ((key === "slug" || key === "note") && !errors[key]) {
      errors[key] = issue.message;
    }
  }
  return errors;
}

type AdminSuspendListingButtonProps = {
  listingId: string;
};

export function AdminSuspendListingButton({
  listingId,
}: AdminSuspendListingButtonProps) {
  const [fieldErrors, setFieldErrors] = useState<SuspendFieldErrors>({});

  return (
    <ConfirmActionButton<SuspendValue>
      title="Suspend listing?"
      description="The seller sees a moderation notice with your reason."
      confirmLabel="Suspend"
      pendingLabel="Suspending..."
      ariaLabel="Suspend listing"
      buttonLabel="Suspend"
      icon={Ban}
      confirmVariant="destructive"
      successMessage="Listing suspended"
      triggerClassName={TRIGGER_CLASS.default}
      initialValue={EMPTY_SUSPEND_VALUE}
      renderBody={({ value, setValue, isPending }) => (
        <div className="flex flex-col gap-3">
          <SelectField
            id="suspend-slug"
            label="Reason"
            placeholder="Choose a reason"
            required
            disabled={isPending}
            options={SLUG_OPTIONS}
            value={value.slug}
            error={fieldErrors.slug}
            onChange={(slug) => {
              setFieldErrors((prev) => ({ ...prev, slug: undefined }));
              setValue({ ...value, slug });
            }}
          />
          <TextareaField
            id="suspend-note"
            label="Note"
            description="Optional. The seller reads this instead of the reason above."
            maxLength={MAX_SUSPENSION_NOTE_LENGTH}
            disabled={isPending}
            value={value.note}
            error={fieldErrors.note}
            onChange={(e) => {
              setFieldErrors((prev) => ({ ...prev, note: undefined }));
              setValue({ ...value, note: e.target.value });
            }}
          />
        </div>
      )}
      onOpen={() => setFieldErrors({})}
      // The same schema the action re-runs, so the operator sees the message
      // on the field before a round trip rather than in a banner after one.
      validate={(value) => {
        const parsed = suspendListingSchema.safeParse(value);
        setFieldErrors(parsed.success ? {} : suspendFieldErrors(parsed.error.issues));
        return parsed.success;
      }}
      onConfirm={async (value) => {
        // Parsed again only to narrow the slug to its union; validate above has
        // already blocked anything this could reject.
        const parsed = suspendListingSchema.safeParse(value);
        if (!parsed.success) return { error: "Choose a reason." };
        return adminSuspendListing(listingId, parsed.data);
      }}
    />
  );
}

type AdminRestoreListingButtonProps = {
  listingId: string;
  previousStatus: AdminListingStatus | null;
};

export function AdminRestoreListingButton({
  listingId,
  previousStatus,
}: AdminRestoreListingButtonProps) {
  return (
    <ConfirmActionButton
      title="Restore listing?"
      description={`Restores the listing to ${
        previousStatus ? ADMIN_STATUS_LABELS[previousStatus] : "its previous status"
      }.`}
      confirmLabel="Restore"
      pendingLabel="Restoring..."
      ariaLabel="Restore listing"
      buttonLabel="Restore"
      icon={RotateCcw}
      successMessage="Listing restored"
      triggerClassName={TRIGGER_CLASS.default}
      onConfirm={() => adminRestoreListing(listingId)}
    />
  );
}

type AdminListingIdProps = { listingId: string };

/**
 * A soft removal at the seller's own explicit request, not moderation. Kept
 * distinct from suspend both in the RPC and in this dialog's copy: suspend
 * reads to the seller as admin-imposed and is meant for us to reverse, which
 * is the wrong frame for a takedown they asked for themselves.
 */
export function AdminRemoveListingButton({
  listingId,
}: AdminListingIdProps) {
  return (
    <ConfirmActionButton
      title="Remove this listing for good?"
      description="Only use this when the seller has explicitly asked you to take the listing down permanently. For routine moderation, suspend instead. This is still a soft removal: it comes off the marketplace immediately, and Restore brings it back if the seller changes their mind."
      confirmLabel="Remove"
      pendingLabel="Removing..."
      ariaLabel="Remove listing for good"
      buttonLabel="Remove"
      icon={Trash2}
      confirmVariant="destructive"
      successMessage="Listing removed"
      triggerClassName={TRIGGER_CLASS.default}
      onConfirm={() => adminRemoveListing(listingId)}
    />
  );
}

export function AdminMarkListingSoldButton({
  listingId,
}: AdminListingIdProps) {
  return (
    <ConfirmActionButton
      title="Mark listing sold?"
      description="Marks this listing and its sizes as sold on the seller's behalf."
      confirmLabel="Mark sold"
      pendingLabel="Marking sold..."
      ariaLabel="Mark listing sold"
      buttonLabel="Mark sold"
      icon={ShoppingBag}
      successMessage="Listing marked sold"
      triggerClassName={TRIGGER_CLASS.default}
      onConfirm={() => adminMarkListingSold(listingId)}
    />
  );
}

export function AdminReactivateListingButton({
  listingId,
}: AdminListingIdProps) {
  return (
    <ConfirmActionButton
      title="Reactivate listing?"
      description="Returns this listing to active on the seller's behalf."
      confirmLabel="Reactivate"
      pendingLabel="Reactivating..."
      ariaLabel="Reactivate listing"
      buttonLabel="Reactivate"
      icon={CheckCircle2}
      successMessage="Listing reactivated"
      triggerClassName={TRIGGER_CLASS.default}
      onConfirm={() => adminReactivateListing(listingId)}
    />
  );
}

type AdminSizeButtonProps = {
  listingId: string;
  sizeId: string;
  size: string;
};

export function AdminMarkSizeSoldButton({
  listingId,
  sizeId,
  size,
}: AdminSizeButtonProps) {
  return (
    <ConfirmActionButton
      title={`Mark size ${size} sold?`}
      description="Marks this one gown sold on the seller's behalf."
      confirmLabel="Mark sold"
      pendingLabel="Marking sold..."
      ariaLabel={`Mark size ${size} sold`}
      icon={ShoppingBag}
      successMessage="Size marked sold"
      triggerClassName={TRIGGER_CLASS.icon}
      triggerStyle="inline-icon"
      onConfirm={() => adminMarkSizeSold(listingId, sizeId)}
    />
  );
}

export function AdminReactivateSizeButton({
  listingId,
  sizeId,
  size,
}: AdminSizeButtonProps) {
  return (
    <ConfirmActionButton
      title={`Reactivate size ${size}?`}
      description="Returns this one gown to available."
      confirmLabel="Reactivate"
      pendingLabel="Reactivating..."
      ariaLabel={`Reactivate size ${size}`}
      icon={CheckCircle2}
      successMessage="Size reactivated"
      triggerClassName={TRIGGER_CLASS.icon}
      triggerStyle="inline-icon"
      onConfirm={() => adminReactivateSize(listingId, sizeId)}
    />
  );
}

type AdminRemoveImageButtonProps = {
  listingId: string;
  imageUrl: string;
  position: number;
};

export function AdminRemoveImageButton({
  listingId,
  imageUrl,
  position,
}: AdminRemoveImageButtonProps) {
  return (
    <ConfirmActionButton
      title="Remove this photo?"
      description="A listing must keep at least one photo."
      confirmLabel="Remove"
      pendingLabel="Removing..."
      ariaLabel={`Remove photo ${position}`}
      icon={ImageOff}
      confirmVariant="destructive"
      successMessage="Photo removed"
      triggerClassName={TRIGGER_CLASS.icon}
      triggerStyle="inline-icon"
      onConfirm={() => adminRemoveListingImage(listingId, imageUrl)}
    />
  );
}

export function AdminReprocessImageButton({
  listingId,
  imageUrl,
  position,
}: AdminRemoveImageButtonProps) {
  return (
    <ConfirmActionButton
      title="Reprocess this photo?"
      description="Reruns face blur and optimization, then replaces the photo."
      confirmLabel="Reprocess"
      pendingLabel="Reprocessing..."
      ariaLabel={`Reprocess photo ${position}`}
      icon={ScanFace}
      successMessage="Photo reprocessed"
      triggerClassName={TRIGGER_CLASS.icon}
      triggerStyle="inline-icon"
      onConfirm={() => adminReprocessListingImage(listingId, imageUrl)}
    />
  );
}

type StudioPhoto = {
  item: Extract<PhotoStudioItem, { kind: "new" }>;
  file: File;
};

/**
 * Add and Replace run the photo studio and the confirm dialog one after the
 * other, never nested: the trigger opens the studio, its Save opens the
 * confirm with the exported file, and Change photo goes back with the same
 * source and edits. Closing either one any other way drops the photo.
 */
function useStudioPhotoFlow(id: string, label: string) {
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [photo, setPhoto] = useState<StudioPhoto | null>(null);
  const [fileError, setFileError] = useState<string>();

  const dropPhoto = () => {
    if (photo) URL.revokeObjectURL(photo.item.image.src);
    setPhoto(null);
  };

  const studio = (
    <PhotoStudioDialog
      open={isStudioOpen}
      onOpenChange={(open) => {
        setIsStudioOpen(open);
        if (!open) dropPhoto();
      }}
      initialItems={photo ? [photo.item] : []}
      maxItems={1}
      mode="single"
      onSave={async ([item]) => {
        if (item?.kind !== "new") return "Choose a photo.";
        const file = await exportEditedImage(item.image, item.edits);
        if (!file) return UNREADABLE_PHOTO_ERROR;
        if (photo && photo.item.image.src !== item.image.src) {
          URL.revokeObjectURL(photo.item.image.src);
        }
        setPhoto({ item, file });
        setFileError(undefined);
        setIsStudioOpen(false);
        setIsConfirmOpen(true);
      }}
    />
  );

  return {
    studio,
    open: isConfirmOpen,
    // The trigger asks to open the confirm; it gets the studio first.
    onOpenChange: (open: boolean) => {
      if (open) {
        dropPhoto();
        setIsStudioOpen(true);
        return;
      }
      setIsConfirmOpen(false);
      dropPhoto();
    },
    // The same schema the action re-runs, so the operator sees the message on
    // the field before a round trip rather than in a banner after one.
    validate: () => {
      const parsed = listingImageFileSchema.safeParse(photo?.file);
      setFileError(parsed.success ? undefined : parsed.error.issues[0]?.message);
      return parsed.success;
    },
    renderBody: ({ isPending }: { isPending: boolean }) => (
      <AdminImageFileField
        id={id}
        label={label}
        file={photo?.file ?? null}
        error={fileError}
        disabled={isPending}
        onChange={() => {
          setIsConfirmOpen(false);
          setIsStudioOpen(true);
        }}
      />
    ),
    file: photo?.file ?? null,
  };
}

function photoFormData(file: File | null): FormData {
  const formData = new FormData();
  if (file) formData.set("photo", file);
  return formData;
}

export function AdminReplaceImageButton({
  listingId,
  imageUrl,
  position,
}: AdminRemoveImageButtonProps) {
  const flow = useStudioPhotoFlow("replace-photo", "New photo");

  return (
    <>
      <ConfirmActionButton
        title="Replace this photo?"
        description="The new photo runs through face blur and optimization. The current photo is deleted once the replacement is saved."
        confirmLabel="Replace"
        pendingLabel="Replacing..."
        ariaLabel={`Replace photo ${position}`}
        icon={ImageUp}
        // Destructive because it does destroy the photo that is there now, even
        // though the replacement has to land first.
        confirmVariant="destructive"
        triggerClassName={TRIGGER_CLASS.icon}
        triggerStyle="inline-icon"
        open={flow.open}
        onOpenChange={flow.onOpenChange}
        renderBody={flow.renderBody}
        validate={flow.validate}
        // No successMessage: the action always returns a face-count notice, which
        // the dialog prefers on the success path.
        onConfirm={() =>
          adminReplaceListingImage(listingId, imageUrl, photoFormData(flow.file))
        }
      />
      {flow.studio}
    </>
  );
}

export function AdminAddImageButton({ listingId }: AdminListingIdProps) {
  const flow = useStudioPhotoFlow("add-photo", "Photo");

  return (
    <>
      <ConfirmActionButton
        title="Add a photo?"
        description="Runs face blur and optimization, then adds the photo to this listing."
        confirmLabel="Add photo"
        pendingLabel="Adding..."
        ariaLabel="Add a photo"
        buttonLabel="Add photo"
        // Stands alone under the grid rather than in a packed row, so it keeps
        // its label at every width instead of collapsing to a bare glyph.
        isLabelAlwaysShown
        icon={ImagePlus}
        triggerClassName={TRIGGER_CLASS.default}
        open={flow.open}
        onOpenChange={flow.onOpenChange}
        renderBody={flow.renderBody}
        validate={flow.validate}
        onConfirm={() => adminAddListingImage(listingId, photoFormData(flow.file))}
      />
      {flow.studio}
    </>
  );
}

type AdminPhotoMoveButtonProps = {
  listingId: string;
  imageUrl: string;
  /** 1-based, matching the RPC's own array indexing. */
  position: number;
  offset: -1 | 1;
  /** Already at that end of the row. */
  atEnd?: boolean;
};

/**
 * Photo 1 is the listing's cover on the browse grid, so a move in or out of it
 * is the one reorder a buyer can see. Every other move only rearranges photos
 * nobody outside the admin is looking at.
 */
function isCoverMove(position: number, offset: -1 | 1): boolean {
  return Math.min(position, position + offset) === 1;
}

function movePhotoLabel(position: number, offset: -1 | 1): string {
  return `Move photo ${position} ${offset === -1 ? "left" : "right"}`;
}

function movePhotoIcon(offset: -1 | 1) {
  return offset === -1 ? ChevronLeft : ChevronRight;
}

/**
 * A reorder is the one admin write that skips the confirm dialog: it is
 * trivially reversible, it is used several times in a row, and there is no
 * consequence to warn about, so a dialog per nudge would be friction with no
 * information in it.
 *
 * The exception to that exception is a move that changes the COVER photo, which
 * is the image buyers see on the browse grid. That one is confirmed like every
 * other buyer-visible change.
 *
 * Both shapes render the identical trigger, so the control row does not change
 * appearance depending on which one a photo happens to get.
 */
export function AdminPhotoMoveButton(props: AdminPhotoMoveButtonProps) {
  return isCoverMove(props.position, props.offset) ? (
    <ConfirmedPhotoMoveButton {...props} />
  ) : (
    <ImmediatePhotoMoveButton {...props} />
  );
}

/** No success toast: the thumbnails visibly move, so only a failure has anything to say. */
function ImmediatePhotoMoveButton({
  listingId,
  imageUrl,
  position,
  offset,
  atEnd,
}: AdminPhotoMoveButtonProps) {
  const [isPending, startTransition] = useTransition();

  const label = movePhotoLabel(position, offset);
  const Icon = movePhotoIcon(offset);
  const isInert = Boolean(atEnd);

  return (
    <button
      type="button"
      disabled={isInert || isPending}
      aria-label={label}
      title={label}
      // shadcn's Button dims itself when disabled; this raw trigger has to.
      className={cn(TRIGGER_CLASS.icon, isInert && "opacity-50")}
      onClick={() =>
        startTransition(async () => {
          const result = await adminMoveListingImage(
            listingId,
            position,
            imageUrl,
            offset,
          );
          if (result?.error) toast.error(result.error);
        })
      }
    >
      {isPending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Icon className="size-3.5" />
      )}
    </button>
  );
}

/**
 * Also no success message, for the same reason as the immediate shape: the
 * dialog closes onto a grid where the photo has already moved.
 */
function ConfirmedPhotoMoveButton({
  listingId,
  imageUrl,
  position,
  offset,
  atEnd,
}: AdminPhotoMoveButtonProps) {
  // Moving left INTO position 1 promotes; moving right OUT of it demotes.
  const isPromotion = offset === -1;

  return (
    <ConfirmActionButton
      title={isPromotion ? "Make this the cover photo?" : "Change the cover photo?"}
      description={
        isPromotion
          ? "The first photo is the one buyers see on the browse page."
          : "The next photo takes its place as the one buyers see on the browse page."
      }
      confirmLabel="Move"
      pendingLabel="Moving..."
      ariaLabel={movePhotoLabel(position, offset)}
      icon={movePhotoIcon(offset)}
      triggerClassName={TRIGGER_CLASS.icon}
      triggerStyle="inline-icon"
      disabled={Boolean(atEnd)}
      onConfirm={() =>
        adminMoveListingImage(listingId, position, imageUrl, offset)
      }
    />
  );
}

type AdminUserIdProps = { userId: string };

export function AdminBanUserButton({ userId }: AdminUserIdProps) {
  return (
    <ConfirmActionButton<boolean>
      title="Ban user?"
      description="Blocks sign-in immediately. An open session lasts until its token expires."
      confirmLabel="Ban"
      pendingLabel="Banning..."
      ariaLabel="Ban user"
      buttonLabel="Ban"
      icon={Ban}
      confirmVariant="destructive"
      successMessage="User banned"
      triggerClassName={TRIGGER_CLASS.default}
      initialValue
      renderBody={({ value, setValue, isPending }) => (
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-(--ink)">
          <Checkbox
            checked={value}
            disabled={isPending}
            onCheckedChange={(checked) => setValue(checked === true)}
          />
          Also suspend their active listings
        </label>
      )}
      onConfirm={(sweepListings) => adminBanUser(userId, { sweepListings })}
    />
  );
}

export function AdminUnbanUserButton({ userId }: AdminUserIdProps) {
  return (
    <ConfirmActionButton
      title="Unban user?"
      description="They can sign in again. Listings suspended by the ban stay suspended."
      confirmLabel="Unban"
      pendingLabel="Unbanning..."
      ariaLabel="Unban user"
      buttonLabel="Unban"
      icon={UserCheck}
      successMessage="User unbanned"
      triggerClassName={TRIGGER_CLASS.default}
      onConfirm={() => adminUnbanUser(userId)}
    />
  );
}

export function AdminDeleteUserButton({ userId }: AdminUserIdProps) {
  return (
    <ConfirmActionButton
      title="Delete account?"
      description="Permanent. Prefer ban when possible. Removes their listings, payments, and saved items."
      confirmLabel="Delete"
      pendingLabel="Deleting..."
      ariaLabel="Delete account"
      buttonLabel="Delete"
      icon={Trash2}
      confirmVariant="destructive"
      successMessage="Account deleted"
      triggerClassName={TRIGGER_CLASS.default}
      onConfirm={() => adminDeleteUser(userId)}
    />
  );
}

type AdminRescuePaymentButtonProps = {
  paymentId: string;
};

export function AdminRescuePaymentButton({
  paymentId,
}: AdminRescuePaymentButtonProps) {
  return (
    <ConfirmActionButton
      title="Rescue payment?"
      description="Re-verifies the Checkout Session with Stripe, then activates the listing if it is paid."
      confirmLabel="Rescue"
      pendingLabel="Verifying..."
      ariaLabel="Rescue payment"
      buttonLabel="Rescue"
      icon={LifeBuoy}
      successMessage="Listing activated"
      triggerClassName={TRIGGER_CLASS.compact}
      onConfirm={() => adminRescuePayment(paymentId)}
    />
  );
}
