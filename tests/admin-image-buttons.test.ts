import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ACCEPTED_LISTING_IMAGE_TYPES } from "@/lib/types";

import type { ReactNode } from "react";

type TriggerState = { error: string | null; isPending: boolean };

type DialogProps = {
  renderTrigger: (state: TriggerState) => ReactNode;
  renderBody?: (state: {
    value: { file: File | null };
    setValue: (next: { file: File | null }) => void;
    isPending: boolean;
  }) => ReactNode;
  validate?: (value: { file: File | null }) => boolean;
  onOpen?: () => void;
  onConfirm: (value: { file: File | null }) => Promise<{ error?: string }>;
  successMessage?: string;
  [key: string]: unknown;
};

const {
  dialogProps,
  mockAdd,
  mockReplace,
  mockMove,
  mockToastError,
} = vi.hoisted(() => ({
  dialogProps: [] as DialogProps[],
  mockAdd: vi.fn(),
  mockReplace: vi.fn(),
  mockMove: vi.fn(),
  mockToastError: vi.fn(),
}));

/** Only the wiring is under test; the dialog's own flow lives in its own file. */
vi.mock("@/components/ConfirmActionDialog", () => ({
  default: (props: DialogProps) => {
    dialogProps.push(props);
    return props.renderTrigger({ error: null, isPending: false });
  },
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: { children?: ReactNode } & Record<string, unknown>) =>
    React.createElement("button", props, children),
}));

// A "use server" module reaches Supabase, Sharp, and next/cache on import.
vi.mock("@/lib/actions/admin/listings", () => ({
  adminAddListingImage: mockAdd,
  adminMarkListingSold: vi.fn(),
  adminMarkSizeSold: vi.fn(),
  adminMoveListingImage: mockMove,
  adminReactivateListing: vi.fn(),
  adminReactivateSize: vi.fn(),
  adminRemoveListing: vi.fn(),
  adminRemoveListingImage: vi.fn(),
  adminReplaceListingImage: mockReplace,
  adminReprocessListingImage: vi.fn(),
  adminRestoreListing: vi.fn(),
  adminSuspendListing: vi.fn(),
}));
vi.mock("@/lib/actions/admin/payments", () => ({ adminRescuePayment: vi.fn() }));
vi.mock("@/lib/actions/admin/users", () => ({
  adminBanUser: vi.fn(),
  adminDeleteUser: vi.fn(),
  adminUnbanUser: vi.fn(),
}));
vi.mock("@/lib/toast", () => ({
  toast: { error: mockToastError, success: vi.fn() },
}));

import {
  AdminAddImageButton,
  AdminPhotoMoveButton,
  AdminReplaceImageButton,
} from "@/app/(admin)/admin-action-buttons";

const LISTING_ID = "11111111-1111-4111-8111-111111111111";
const IMAGE_URL =
  "https://proj.supabase.co/storage/v1/object/public/gown-images/a.webp";
const DEMO_TITLE = "Turn off demo mode to make changes.";

function photo(type = "image/jpeg"): File {
  return new File([new Uint8Array([1, 2, 3])], "gown.jpg", { type });
}

function render(element: React.ReactElement): string {
  return renderToStaticMarkup(element);
}

beforeEach(() => {
  vi.clearAllMocks();
  dialogProps.length = 0;
  mockAdd.mockResolvedValue({});
  mockReplace.mockResolvedValue({});
  mockMove.mockResolvedValue({});
});

describe("AdminReplaceImageButton", () => {
  it("renders a live icon trigger named for its photo", () => {
    const html = render(
      React.createElement(AdminReplaceImageButton, {
        listingId: LISTING_ID,
        imageUrl: IMAGE_URL,
        position: 2,
      }),
    );

    expect(html).toContain('aria-label="Replace photo 2"');
    expect(html).not.toContain("disabled");
  });

  it("goes visibly inert in demo mode and says why", () => {
    const html = render(
      React.createElement(AdminReplaceImageButton, {
        listingId: LISTING_ID,
        imageUrl: IMAGE_URL,
        position: 1,
        isDemo: true,
      }),
    );

    expect(html).toContain("disabled");
    expect(html).toContain(`title="${DEMO_TITLE}"`);
    expect(html).toContain("opacity-50");
  });

  it("blocks confirm with no photo picked, and lets a valid one through", () => {
    render(
      React.createElement(AdminReplaceImageButton, {
        listingId: LISTING_ID,
        imageUrl: IMAGE_URL,
        position: 1,
      }),
    );

    const props = dialogProps[0];
    expect(props.validate?.({ file: null })).toBe(false);
    expect(props.validate?.({ file: photo("image/heic") })).toBe(false);
    expect(props.validate?.({ file: photo() })).toBe(true);
  });

  it("passes a FormData carrying the file, with both targets", async () => {
    render(
      React.createElement(AdminReplaceImageButton, {
        listingId: LISTING_ID,
        imageUrl: IMAGE_URL,
        position: 1,
      }),
    );

    const file = photo();
    await dialogProps[0].onConfirm({ file });

    expect(mockReplace).toHaveBeenCalledOnce();
    const [listingId, imageUrl, formData] = mockReplace.mock.calls[0];
    expect(listingId).toBe(LISTING_ID);
    expect(imageUrl).toBe(IMAGE_URL);
    expect(formData).toBeInstanceOf(FormData);
    expect(formData.get("photo")).toBe(file);
  });

  it("leaves the success message to the action's own face-count notice", () => {
    render(
      React.createElement(AdminReplaceImageButton, {
        listingId: LISTING_ID,
        imageUrl: IMAGE_URL,
        position: 1,
      }),
    );
    expect(dialogProps[0].successMessage).toBeUndefined();
  });

  it("renders a picker that only offers what the pipeline can decode", () => {
    render(
      React.createElement(AdminReplaceImageButton, {
        listingId: LISTING_ID,
        imageUrl: IMAGE_URL,
        position: 1,
      }),
    );

    const body = dialogProps[0].renderBody?.({
      value: { file: null },
      setValue: () => {},
      isPending: false,
    });
    const html = renderToStaticMarkup(body as React.ReactElement);

    expect(html).toContain('type="file"');
    expect(html).toContain(ACCEPTED_LISTING_IMAGE_TYPES.join(","));
    expect(html).not.toContain("image/heic");
  });
});

describe("AdminAddImageButton", () => {
  it("renders a labelled trigger and goes inert in demo mode", () => {
    expect(
      render(
        React.createElement(AdminAddImageButton, { listingId: LISTING_ID }),
      ),
    ).toContain('aria-label="Add a photo"');

    const demo = render(
      React.createElement(AdminAddImageButton, {
        listingId: LISTING_ID,
        isDemo: true,
      }),
    );
    expect(demo).toContain("disabled");
    expect(demo).toContain(`title="${DEMO_TITLE}"`);
  });

  it("keeps its label at every width, unlike the packed row actions", () => {
    const html = render(
      React.createElement(AdminAddImageButton, { listingId: LISTING_ID }),
    );
    expect(html).toContain("Add photo");
    expect(html).not.toContain("hidden sm:inline");
  });

  it("blocks confirm with no photo picked", () => {
    render(React.createElement(AdminAddImageButton, { listingId: LISTING_ID }));
    expect(dialogProps[0].validate?.({ file: null })).toBe(false);
  });

  it("passes a FormData carrying the file", async () => {
    render(React.createElement(AdminAddImageButton, { listingId: LISTING_ID }));

    const file = photo("image/png");
    await dialogProps[0].onConfirm({ file });

    const [listingId, formData] = mockAdd.mock.calls[0];
    expect(listingId).toBe(LISTING_ID);
    expect(formData.get("photo")).toBe(file);
  });
});

describe("AdminPhotoMoveButton: an ordinary move", () => {
  // Neither end of this move touches position 1, so nothing a buyer sees moves.
  const PLAIN = { listingId: LISTING_ID, imageUrl: IMAGE_URL, position: 2, offset: 1 } as const;

  it("names its direction and is live in the middle of the row", () => {
    const html = render(React.createElement(AdminPhotoMoveButton, { ...PLAIN }));
    expect(html).toContain('aria-label="Move photo 2 right"');
    expect(html).not.toContain("disabled");
  });

  // Deliberately not confirm-gated: reversible, repeated, and with no
  // consequence a dialog could explain.
  it("opens no dialog at all", () => {
    render(React.createElement(AdminPhotoMoveButton, { ...PLAIN }));
    expect(dialogProps).toHaveLength(0);
  });

  it("is inert and dimmed at the end of the row", () => {
    const html = render(
      React.createElement(AdminPhotoMoveButton, {
        listingId: LISTING_ID,
        imageUrl: IMAGE_URL,
        position: 3,
        offset: 1,
        atEnd: true,
      }),
    );
    expect(html).toContain("disabled");
    expect(html).toContain("opacity-50");
  });

  it("is inert in demo mode and says why", () => {
    const html = render(
      React.createElement(AdminPhotoMoveButton, { ...PLAIN, isDemo: true }),
    );
    expect(html).toContain("disabled");
    expect(html).toContain(`title="${DEMO_TITLE}"`);
  });
});

describe("AdminPhotoMoveButton: a move that changes the cover photo", () => {
  // Photo 1 is the image buyers see on the browse grid, so these two moves are
  // the only reorders with a consequence outside the admin.
  const PROMOTE = { listingId: LISTING_ID, imageUrl: IMAGE_URL, position: 2, offset: -1 } as const;
  const DEMOTE = { listingId: LISTING_ID, imageUrl: IMAGE_URL, position: 1, offset: 1 } as const;

  it("confirms a promotion into position 1, naming the cover", () => {
    render(React.createElement(AdminPhotoMoveButton, { ...PROMOTE }));

    expect(dialogProps).toHaveLength(1);
    expect(dialogProps[0].title).toBe("Make this the cover photo?");
    expect(dialogProps[0].description).toBe(
      "The first photo is the one buyers see on the browse page.",
    );
  });

  it("confirms a demotion out of position 1, with its own copy", () => {
    render(React.createElement(AdminPhotoMoveButton, { ...DEMOTE }));

    expect(dialogProps).toHaveLength(1);
    expect(dialogProps[0].title).toBe("Change the cover photo?");
    expect(dialogProps[0].description).toBe(
      "The next photo takes its place as the one buyers see on the browse page.",
    );
  });

  it("calls the action with the same arguments the immediate shape would", async () => {
    render(React.createElement(AdminPhotoMoveButton, { ...PROMOTE }));
    await dialogProps[0].onConfirm({ file: null });

    expect(mockMove).toHaveBeenCalledExactlyOnceWith(LISTING_ID, 2, IMAGE_URL, -1);
  });

  it("stays silent on success, since the thumbnails visibly move", () => {
    render(React.createElement(AdminPhotoMoveButton, { ...PROMOTE }));
    expect(dialogProps[0].successMessage).toBeUndefined();
  });

  it("renders the identical trigger, so the row does not change shape", () => {
    const html = render(React.createElement(AdminPhotoMoveButton, { ...PROMOTE }));
    expect(html).toContain('aria-label="Move photo 2 left"');
    expect(html).not.toContain("disabled");
  });

  it("is inert in demo mode and says why", () => {
    const html = render(
      React.createElement(AdminPhotoMoveButton, { ...PROMOTE, isDemo: true }),
    );
    expect(html).toContain("disabled");
    expect(html).toContain(`title="${DEMO_TITLE}"`);
    expect(html).toContain("opacity-50");
  });

  it("leaves photo 1's own left arrow on the immediate shape, since it goes nowhere", () => {
    render(
      React.createElement(AdminPhotoMoveButton, {
        listingId: LISTING_ID,
        imageUrl: IMAGE_URL,
        position: 1,
        offset: -1,
        atEnd: true,
      }),
    );
    expect(dialogProps).toHaveLength(0);
  });
});
