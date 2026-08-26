import { describe, expect, it } from "vitest";

import {
  MAX_SUSPENSION_NOTE_LENGTH,
  SUSPENSION_REASON_SENTENCES,
  SUSPENSION_SLUGS,
  SUSPENSION_SLUG_LABELS,
  sellerSuspensionMessage,
} from "@/lib/suspension";
import {
  adminListingIdSchema,
  adminSizeIdSchema,
  removeListingImageSchema,
  suspendListingSchema,
} from "@/lib/validations/admin/listing-schema";
import { adminPaymentIdSchema } from "@/lib/validations/admin/payment-schema";
import {
  BAN_DURATION,
  BAN_SWEEP_SLUG,
  UNBAN_DURATION,
  adminUserIdSchema,
  banUserSchema,
} from "@/lib/validations/admin/user-schema";

const UUID = "11111111-1111-4111-8111-111111111111";

describe("suspendListingSchema", () => {
  it("accepts every slug in the taxonomy", () => {
    for (const slug of SUSPENSION_SLUGS) {
      const parsed = suspendListingSchema.safeParse({ slug });
      expect(parsed.success, slug).toBe(true);
      expect(parsed.success && parsed.data.slug).toBe(slug);
    }
  });

  it("rejects an unknown, empty, missing, or non-string slug without coercing", () => {
    for (const slug of ["spam ", "SPAM", "not-a-slug", "", undefined, 3, null]) {
      expect(suspendListingSchema.safeParse({ slug }).success).toBe(false);
    }
  });

  it("treats an absent note as undefined", () => {
    const parsed = suspendListingSchema.safeParse({ slug: "spam" });
    expect(parsed.success && parsed.data.note).toBeUndefined();
  });

  it("collapses a whitespace-only note to undefined, never an empty string", () => {
    const parsed = suspendListingSchema.safeParse({
      slug: "spam",
      note: "   \n\t ",
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.note).toBeUndefined();
  });

  it("trims surrounding whitespace off a real note", () => {
    const parsed = suspendListingSchema.safeParse({
      slug: "other",
      note: "  Duplicate of listing 12.  ",
    });
    expect(parsed.success && parsed.data.note).toBe("Duplicate of listing 12.");
  });

  it("accepts a note at the length limit and rejects one past it", () => {
    const atLimit = "x".repeat(MAX_SUSPENSION_NOTE_LENGTH);
    expect(
      suspendListingSchema.safeParse({ slug: "spam", note: atLimit }).success,
    ).toBe(true);
    expect(
      suspendListingSchema.safeParse({ slug: "spam", note: `${atLimit}x` })
        .success,
    ).toBe(false);
  });

  it("measures the limit after trimming, so padding alone is not a rejection", () => {
    const padded = ` ${"x".repeat(MAX_SUSPENSION_NOTE_LENGTH)} `;
    expect(
      suspendListingSchema.safeParse({ slug: "spam", note: padded }).success,
    ).toBe(true);
  });

  it("rejects a non-string note rather than stringifying it", () => {
    expect(
      suspendListingSchema.safeParse({ slug: "spam", note: 42 }).success,
    ).toBe(false);
  });
});

describe("suspension vocabulary", () => {
  it("gives every slug exactly one non-empty seller sentence", () => {
    expect(Object.keys(SUSPENSION_REASON_SENTENCES).sort()).toEqual(
      [...SUSPENSION_SLUGS].sort(),
    );
    for (const slug of SUSPENSION_SLUGS) {
      expect(SUSPENSION_REASON_SENTENCES[slug].length).toBeGreaterThan(0);
    }
  });

  it("gives every slug exactly one operator label", () => {
    expect(Object.keys(SUSPENSION_SLUG_LABELS).sort()).toEqual(
      [...SUSPENSION_SLUGS].sort(),
    );
  });

  it("never puts an em dash in copy a seller reads", () => {
    for (const sentence of Object.values(SUSPENSION_REASON_SENTENCES)) {
      expect(sentence).not.toContain("—");
    }
  });
});

describe("sellerSuspensionMessage", () => {
  it("returns the slug's own sentence when the reason is just the slug", () => {
    for (const slug of SUSPENSION_SLUGS) {
      expect(sellerSuspensionMessage(slug, slug)).toBe(
        SUSPENSION_REASON_SENTENCES[slug],
      );
    }
  });

  it("returns the operator's note when one was stored", () => {
    expect(
      sellerSuspensionMessage("image-policy", "Blur the faces and relist."),
    ).toBe("Blur the faces and relist.");
  });

  it("falls back to the generic sentence when the slug is missing", () => {
    expect(sellerSuspensionMessage(null, null)).toBe(
      SUSPENSION_REASON_SENTENCES.other,
    );
  });

  it("falls back to the generic sentence for an unrecognised slug with no note", () => {
    expect(sellerSuspensionMessage("mystery", "mystery")).toBe(
      SUSPENSION_REASON_SENTENCES.other,
    );
  });

  it("renders a note even when the slug was not recorded", () => {
    expect(sellerSuspensionMessage(null, "Removed for policy reasons.")).toBe(
      "Removed for policy reasons.",
    );
  });
});

describe("id schemas", () => {
  const schemas = {
    listing: adminListingIdSchema,
    size: adminSizeIdSchema,
    payment: adminPaymentIdSchema,
    user: adminUserIdSchema,
  };

  it("accepts a uuid", () => {
    for (const [name, schema] of Object.entries(schemas)) {
      expect(schema.safeParse(UUID).success, name).toBe(true);
    }
  });

  it("rejects empty, non-uuid, and non-string ids without coercing", () => {
    for (const [name, schema] of Object.entries(schemas)) {
      for (const bad of ["", "listing-1", 7, null, undefined, {}]) {
        expect(schema.safeParse(bad).success, `${name}:${String(bad)}`).toBe(
          false,
        );
      }
    }
  });
});

describe("removeListingImageSchema", () => {
  it("accepts a listing uuid plus a URL", () => {
    const parsed = removeListingImageSchema.safeParse({
      listingId: UUID,
      imageUrl: "https://example.supabase.co/storage/v1/object/public/gown-images/a.webp",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a bucket path masquerading as a URL", () => {
    expect(
      removeListingImageSchema.safeParse({
        listingId: UUID,
        imageUrl: "../../secret.webp",
      }).success,
    ).toBe(false);
  });

  it("rejects an invalid listing id", () => {
    expect(
      removeListingImageSchema.safeParse({
        listingId: "nope",
        imageUrl: "https://example.com/a.webp",
      }).success,
    ).toBe(false);
  });
});

describe("banUserSchema", () => {
  it("accepts both booleans without truthy coercion", () => {
    expect(
      banUserSchema.safeParse({ userId: UUID, sweepListings: true }).success,
    ).toBe(true);
    const off = banUserSchema.safeParse({ userId: UUID, sweepListings: false });
    expect(off.success && off.data.sweepListings).toBe(false);
  });

  it("defaults the sweep on when the flag is absent", () => {
    const parsed = banUserSchema.safeParse({ userId: UUID });
    expect(parsed.success && parsed.data.sweepListings).toBe(true);
  });

  it("rejects a non-boolean sweep flag rather than coercing it", () => {
    for (const bad of ["yes", 1, null]) {
      expect(
        banUserSchema.safeParse({ userId: UUID, sweepListings: bad }).success,
      ).toBe(false);
    }
  });

  it("rejects an invalid user id", () => {
    expect(banUserSchema.safeParse({ userId: "", sweepListings: true }).success)
      .toBe(false);
  });
});

describe("ban constants", () => {
  it("uses the far-future duration for a ban and 'none' to lift it", () => {
    expect(BAN_DURATION).toBe("876000h");
    expect(UNBAN_DURATION).toBe("none");
  });

  it("sweeps under a slug the taxonomy actually carries", () => {
    expect(SUSPENSION_SLUGS).toContain(BAN_SWEEP_SLUG);
  });
});

describe("suspend issues are addressed to a field, not a banner", () => {
  it("puts a missing slug on the slug field", () => {
    const parsed = suspendListingSchema.safeParse({ slug: "", note: "" });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.every((i) => i.path[0] === "slug")).toBe(true);
  });

  it("puts an over-long note on the note field", () => {
    const parsed = suspendListingSchema.safeParse({
      slug: "spam",
      note: "x".repeat(MAX_SUSPENSION_NOTE_LENGTH + 1),
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.every((i) => i.path[0] === "note")).toBe(true);
  });

  it("addresses each field separately when both are wrong", () => {
    const parsed = suspendListingSchema.safeParse({
      slug: "nope",
      note: "x".repeat(MAX_SUSPENSION_NOTE_LENGTH + 1),
    });
    expect(parsed.success).toBe(false);
    const paths = parsed.error?.issues.map((i) => i.path[0]) ?? [];
    expect(new Set(paths)).toEqual(new Set(["slug", "note"]));
  });
});
