import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ImageSlotState } from "@/lib/types";

type DropzoneOptions = {
  onDrop: (acceptedFiles: File[]) => void;
  accept?: Record<string, string[]>;
  multiple?: boolean;
  useFsAccessApi?: boolean;
};

type DropzoneRenderState = {
  isDragActive: boolean;
  isDragReject: boolean;
};

type CapturedDropzone = {
  options: DropzoneOptions;
  rootProps: Record<string, unknown>;
  inputProps: Record<string, unknown>;
};

type MockImageProps = {
  src: string;
  alt: string;
};

const { dropzoneCalls, dropzoneStates } = vi.hoisted(() => ({
  dropzoneCalls: [] as CapturedDropzone[],
  dropzoneStates: [] as DropzoneRenderState[],
}));

vi.mock("next/image", async () => {
  const react = await vi.importActual<typeof import("react")>("react");

  return {
    default: ({ src, alt }: MockImageProps) =>
      react.createElement("img", { src, alt }),
  };
});

vi.mock("react-dropzone", () => ({
  useDropzone: (options: DropzoneOptions) => {
    const index = dropzoneCalls.length;
    const captured: CapturedDropzone = {
      options,
      rootProps: {},
      inputProps: {},
    };
    dropzoneCalls.push(captured);

    return {
      getRootProps: (props: Record<string, unknown> = {}) => {
        captured.rootProps = props;
        return props;
      },
      getInputProps: (props: Record<string, unknown> = {}) => {
        captured.inputProps = props;
        return props;
      },
      isDragActive: dropzoneStates[index]?.isDragActive ?? false,
      isDragReject: dropzoneStates[index]?.isDragReject ?? false,
    };
  },
}));

import { ListingPhotoField } from "@/components/ListingPhotoField";

function makeSlot(
  id: string,
  overrides: Partial<ImageSlotState> = {},
): ImageSlotState {
  return {
    id,
    preview: null,
    imageFile: null,
    optimizedDataUrl: null,
    blurPromise: Promise.resolve(null),
    optimizing: false,
    optimizeError: "",
    existingUrl: null,
    ...overrides,
  };
}

function renderPhotoField(
  slots: ImageSlotState[],
  onFileSelected = vi.fn(),
  onClear = vi.fn(),
): string {
  return renderToStaticMarkup(
    React.createElement(ListingPhotoField, {
      slots,
      onFileSelected,
      onClear,
    }),
  );
}

describe("ListingPhotoField", () => {
  beforeEach(() => {
    dropzoneCalls.length = 0;
    dropzoneStates.length = 0;
  });

  it("routes an accepted dropped file to the handler with the correct slot index", () => {
    const file = new File(["image"], "slot-2.webp", { type: "image/webp" });
    const onFileSelected = vi.fn();

    renderPhotoField(
      [makeSlot("slot-0"), makeSlot("slot-1"), makeSlot("slot-2")],
      onFileSelected,
    );

    dropzoneCalls[1]?.options.onDrop([file]);

    expect(onFileSelected).toHaveBeenCalledOnce();
    expect(onFileSelected).toHaveBeenCalledWith(1, file);
    expect(dropzoneCalls[1]?.options.accept).toEqual({ "image/*": [] });
    expect(dropzoneCalls[1]?.options.multiple).toBe(false);
    expect(dropzoneCalls[1]?.inputProps).toMatchObject({ id: "photo-1" });
    expect(dropzoneCalls[1]?.rootProps["aria-label"]).toBe(
      "Photo 2 (optional)",
    );
  });

  it("keeps an existing edit-mode photo visible and labels the replacement affordance", () => {
    const html = renderPhotoField([
      makeSlot("slot-0"),
      makeSlot("slot-1", {
        preview: "https://example.com/existing.webp",
        existingUrl: "https://example.com/existing.webp",
      }),
      makeSlot("slot-2"),
    ]);

    expect(html).toContain('src="https://example.com/existing.webp"');
    expect(html).toContain('alt="Photo 2 preview"');
    expect(html).toContain("Replace");
    expect(html).toContain('aria-label="Remove photo 2"');
  });

  it("shows busy slot feedback while a photo is optimizing", () => {
    const html = renderPhotoField([
      makeSlot("slot-0", { optimizing: true }),
      makeSlot("slot-1"),
      makeSlot("slot-2"),
    ]);

    expect(html).toContain("Optimizing image");
  });

  it("communicates rejected non-image drops and ignores empty accepted files", () => {
    dropzoneStates[0] = { isDragActive: true, isDragReject: true };
    const onFileSelected = vi.fn();

    const html = renderPhotoField(
      [makeSlot("slot-0"), makeSlot("slot-1"), makeSlot("slot-2")],
      onFileSelected,
    );
    dropzoneCalls[0]?.options.onDrop([]);

    expect(html).toContain("Images only");
    expect(onFileSelected).not.toHaveBeenCalled();
  });
});
