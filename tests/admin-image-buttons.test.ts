import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ReactElement, ReactNode } from "react";
import type { EditableImage, PhotoEdits, PhotoStudioItem } from "@/lib/types";

type TriggerState = { error: string | null; isPending: boolean };

type DialogProps = {
  renderTrigger: (state: TriggerState) => ReactNode;
  renderBody?: (state: { value: unknown; setValue: () => void; isPending: boolean }) => ReactNode;
  validate?: (value?: unknown) => boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onConfirm: (value?: unknown) => Promise<{ error?: string }>;
  successMessage?: string;
  [key: string]: unknown;
};

type StudioProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialItems: PhotoStudioItem[];
  maxItems: number;
  mode: string;
  onSave: (items: PhotoStudioItem[]) => Promise<string | void>;
};

type FileFieldProps = {
  file: File | null;
  error?: string;
  disabled?: boolean;
  onChange: () => void;
};

const {
  dialogProps,
  studioProps,
  hookState,
  mockAdd,
  mockReplace,
  mockMove,
  mockToastError,
  mockExport,
} = vi.hoisted(() => ({
  dialogProps: [] as DialogProps[],
  studioProps: [] as StudioProps[],
  hookState: { states: [] as unknown[], index: 0 },
  mockAdd: vi.fn(),
  mockReplace: vi.fn(),
  mockMove: vi.fn(),
  mockToastError: vi.fn(),
  mockExport: vi.fn(),
}));

/** State persists across renders by call order, like React's own. */
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useState: <State>(initial: State): [State, (next: unknown) => void] => {
      const index = hookState.index++;
      if (!(index in hookState.states)) hookState.states[index] = initial;
      return [
        hookState.states[index] as State,
        (next: unknown) => {
          hookState.states[index] =
            typeof next === "function"
              ? (next as (current: unknown) => unknown)(hookState.states[index])
              : next;
        },
      ];
    },
  };
});

vi.mock("@/lib/image-upload", () => ({
  exportEditedImage: mockExport,
  UNREADABLE_PHOTO_ERROR: "This photo can't be opened. Try a JPG or PNG.",
}));

/** Only the wiring is under test; the dialog's own flow lives in its own file. */
vi.mock("@/components/ConfirmActionDialog", () => ({
  default: (props: DialogProps) => {
    dialogProps.push(props);
    return props.renderTrigger({ error: null, isPending: false });
  },
}));

vi.mock("@/components/photo-studio/PhotoStudioDialog", () => ({
  PhotoStudioDialog: (props: StudioProps) => {
    studioProps.push(props);
    return null;
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
import { AdminImageFileField } from "@/app/(admin)/AdminImageFileField";

const LISTING_ID = "11111111-1111-4111-8111-111111111111";
const IMAGE_URL =
  "https://proj.supabase.co/storage/v1/object/public/gown-images/a.webp";
const DEMO_TITLE = "Turn off demo mode to make changes.";
const UNREADABLE = "This photo can't be opened. Try a JPG or PNG.";

const EDITS: PhotoEdits = {
  framing: "crop",
  crop: { x: 0, y: 0, width: 300, height: 400 },
  rotation90: 0,
  tilt: 0,
  brightness: 12,
  zoom: 1.4,
  position: { x: 0.1, y: 0 },
};
const SOURCE: EditableImage = { src: "blob:source", width: 300, height: 400, name: "gown.jpg" };
const ITEM: PhotoStudioItem = { id: "p1", kind: "new", image: SOURCE, edits: EDITS };

function photo(type = "image/webp"): File {
  return new File([new Uint8Array([1, 2, 3])], "gown.webp", { type });
}

function render(element: React.ReactElement): string {
  hookState.index = 0;
  dialogProps.length = 0;
  studioProps.length = 0;
  return renderToStaticMarkup(element);
}

function confirm(): DialogProps {
  return dialogProps[dialogProps.length - 1];
}

function studio(): StudioProps {
  return studioProps[studioProps.length - 1];
}

function fileField(): ReactElement<FileFieldProps> {
  return confirm().renderBody?.({
    value: undefined,
    setValue: () => {},
    isPending: false,
  }) as ReactElement<FileFieldProps>;
}

beforeEach(() => {
  vi.clearAllMocks();
  hookState.states = [];
  mockAdd.mockResolvedValue({});
  mockReplace.mockResolvedValue({});
  mockMove.mockResolvedValue({});
  vi.stubGlobal("URL", { ...URL, revokeObjectURL: vi.fn(), createObjectURL: vi.fn() });
});

/** Trigger click, studio Save, then the confirm as the operator sees it. */
async function saveFromStudio(element: () => React.ReactElement, item = ITEM) {
  render(element());
  confirm().onOpenChange?.(true);
  render(element());
  const message = await studio().onSave([item]);
  render(element());
  return message;
}

describe("AdminReplaceImageButton", () => {
  const replace = () =>
    React.createElement(AdminReplaceImageButton, {
      listingId: LISTING_ID,
      imageUrl: IMAGE_URL,
      position: 2,
    });

  it("renders a live icon trigger named for its photo", () => {
    const html = render(replace());

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

  it("passes a FormData carrying the exported file, with both targets", async () => {
    const exported = photo();
    mockExport.mockResolvedValue(exported);
    await saveFromStudio(replace);

    await confirm().onConfirm();

    expect(mockReplace).toHaveBeenCalledOnce();
    const [listingId, imageUrl, formData] = mockReplace.mock.calls[0];
    expect(listingId).toBe(LISTING_ID);
    expect(imageUrl).toBe(IMAGE_URL);
    expect(formData).toBeInstanceOf(FormData);
    expect(formData.get("photo")).toBe(exported);
  });

  it("leaves the success message to the action's own face-count notice", () => {
    render(replace());
    expect(confirm().successMessage).toBeUndefined();
  });
});

describe("AdminAddImageButton", () => {
  const add = () => React.createElement(AdminAddImageButton, { listingId: LISTING_ID });

  it("renders a labelled trigger and goes inert in demo mode", () => {
    expect(render(add())).toContain('aria-label="Add a photo"');

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
    const html = render(add());
    expect(html).toContain("Add photo");
    expect(html).not.toContain("hidden sm:inline");
  });

  it("passes a FormData carrying the exported file", async () => {
    const exported = photo("image/jpeg");
    mockExport.mockResolvedValue(exported);
    await saveFromStudio(add);

    await confirm().onConfirm();

    const [listingId, formData] = mockAdd.mock.calls[0];
    expect(listingId).toBe(LISTING_ID);
    expect(formData.get("photo")).toBe(exported);
  });
});

describe("photo dialogs: the studio runs first, then the confirm", () => {
  const add = () => React.createElement(AdminAddImageButton, { listingId: LISTING_ID });

  it("opens the studio in single mode on the trigger, not the confirm", () => {
    render(add());
    confirm().onOpenChange?.(true);
    render(add());

    expect(studio()).toMatchObject({ open: true, maxItems: 1, mode: "single", initialItems: [] });
    expect(confirm().open).toBe(false);
  });

  it("exports on Save, then opens the confirm with that file and closes the studio", async () => {
    const exported = photo();
    mockExport.mockResolvedValue(exported);

    await expect(saveFromStudio(add)).resolves.toBeUndefined();

    expect(mockExport).toHaveBeenCalledExactlyOnceWith(SOURCE, EDITS);
    expect(studio().open).toBe(false);
    expect(confirm().open).toBe(true);
    expect(fileField().props.file).toBe(exported);
    expect(confirm().validate?.()).toBe(true);
  });

  it("keeps the studio open with a message when the export fails", async () => {
    mockExport.mockResolvedValue(null);

    await expect(saveFromStudio(add)).resolves.toBe(UNREADABLE);

    expect(studio().open).toBe(true);
    expect(confirm().open).toBe(false);
  });

  it("asks for a photo when the studio is saved empty", async () => {
    render(add());
    confirm().onOpenChange?.(true);
    render(add());

    await expect(studio().onSave([])).resolves.toBe("Choose a photo.");
    expect(mockExport).not.toHaveBeenCalled();
  });

  it("goes back to the studio with the same source and edits from Change photo", async () => {
    mockExport.mockResolvedValue(photo());
    await saveFromStudio(add);

    fileField().props.onChange();
    render(add());

    expect(confirm().open).toBe(false);
    expect(studio().open).toBe(true);
    expect(studio().initialItems).toEqual([ITEM]);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it("opens nothing when the studio is then closed, and drops the photo", async () => {
    mockExport.mockResolvedValue(photo());
    await saveFromStudio(add);
    fileField().props.onChange();
    render(add());

    studio().onOpenChange(false);
    render(add());

    expect(studio().open).toBe(false);
    expect(confirm().open).toBe(false);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:source");
  });

  it("revokes the earlier source when Change photo ends with a different pick", async () => {
    mockExport.mockResolvedValue(photo());
    await saveFromStudio(add);
    fileField().props.onChange();
    render(add());

    const other: PhotoStudioItem = { ...ITEM, id: "p2", image: { ...SOURCE, src: "blob:other" } };
    await studio().onSave([other]);
    render(add());

    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:source");
    expect(confirm().open).toBe(true);
  });

  it("drops the photo when the confirm closes, by cancel or by success", async () => {
    mockExport.mockResolvedValue(photo());
    await saveFromStudio(add);

    confirm().onOpenChange?.(false);
    render(add());

    expect(confirm().open).toBe(false);
    expect(fileField().props.file).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:source");
  });

  it("blocks confirm with no photo, and checks the export against the same schema", async () => {
    render(add());
    expect(confirm().validate?.()).toBe(false);
    render(add());
    expect(fileField().props.error).toBe("Choose a photo.");

    mockExport.mockResolvedValue(photo("image/heic"));
    await saveFromStudio(add);
    expect(confirm().validate?.()).toBe(false);
  });
});

describe("AdminImageFileField", () => {
  it("offers Change photo instead of a file input and shows the field's error", () => {
    hookState.index = 0;
    const html = renderToStaticMarkup(
      React.createElement(AdminImageFileField, {
        id: "add-photo",
        label: "Photo",
        file: photo(),
        error: "Keep the photo under 25 MB.",
        onChange: vi.fn(),
      }),
    );

    expect(html).toContain("Change photo");
    expect(html).toContain("Keep the photo under 25 MB.");
    expect(html).not.toContain('type="file"');
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
    await dialogProps[0].onConfirm();

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
