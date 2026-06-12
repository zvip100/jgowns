import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ImageSlotState, ListingFormData } from "@/lib/types";

type StateSetterCall = {
  index: number;
  value: unknown;
};

type SetStateAction<State> = State | ((current: State) => State);

const {
  hookState,
  mockCreateListing,
  mockPush,
  mockUnstableRethrow,
  mockUpdateListing,
} = vi.hoisted(() => ({
  hookState: {
    callCount: 0,
    overrides: new Map<number, unknown>(),
    refCallCount: 0,
    refOverrides: new Map<number, unknown>(),
    setterCalls: [] as StateSetterCall[],
  },
  mockCreateListing: vi.fn(),
  mockPush: vi.fn(),
  mockUnstableRethrow: vi.fn(),
  mockUpdateListing: vi.fn(),
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useCallback: <Callback>(callback: Callback): Callback => callback,
    useRef: <Value>(value: Value) => {
      const index = hookState.refCallCount++;
      const current = hookState.refOverrides.has(index)
        ? hookState.refOverrides.get(index)
        : value;

      return { current };
    },
    useState: <State>(
      initial: State | (() => State),
    ): [State, (next: SetStateAction<State>) => void] => {
      const index = hookState.callCount++;
      const initialValue =
        typeof initial === "function" ? (initial as () => State)() : initial;
      const value = hookState.overrides.has(index)
        ? hookState.overrides.get(index)
        : initialValue;
      const setState = (next: SetStateAction<State>) => {
        hookState.setterCalls.push({ index, value: next });
      };

      return [value as State, setState];
    },
  };
});

vi.mock("next/navigation", () => ({
  unstable_rethrow: mockUnstableRethrow,
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/lib/actions/sell", () => ({
  createListing: mockCreateListing,
  updateListing: mockUpdateListing,
}));

import { useListingFormSubmit } from "@/hooks/useListingFormSubmit";

const LISTING_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const EXISTING_URL = "https://example.com/existing.webp";
const SECOND_URL = "https://example.com/second.webp";
const BLUR_DATA_URL = "data:image/jpeg;base64,blur";

function makeInitialForm(): Partial<ListingFormData> {
  return {
    title: "Original Gown",
    description: "Original description",
    size: "8",
    size_group: "adult",
    color: "Ivory",
    location: "Borough Park",
    condition: "Brand New",
    category: "bridal",
    price: 800,
    image_urls: [EXISTING_URL],
    image_blur_data_urls: [BLUR_DATA_URL],
    contact_email: "seller@example.com",
    contact_phone: "(555) 111-2222",
    status: "active",
  };
}

function makeValidForm(): Partial<ListingFormData> {
  return {
    title: "Valid Gown",
    description: "A lovely gown",
    size: "8",
    size_group: "adult",
    color: "Ivory",
    location: "Borough Park",
    condition: "Brand New",
    category: "bridal",
    price: 800,
    contact_email: "seller@example.com",
    contact_phone: "5551112222",
    status: "active",
  };
}

function makeSlot(overrides: Partial<ImageSlotState> = {}): ImageSlotState {
  return {
    id: "slot-0",
    preview: EXISTING_URL,
    imageFile: null,
    optimizedDataUrl: null,
    blurPromise: Promise.resolve(BLUR_DATA_URL),
    optimizing: false,
    optimizeError: "",
    existingUrl: EXISTING_URL,
    ...overrides,
  };
}

function loadingSetterValues(): unknown[] {
  return hookState.setterCalls
    .filter((call) => call.index === 0)
    .map((call) => call.value);
}

function errorSetterValues(): unknown[] {
  return hookState.setterCalls
    .filter((call) => call.index === 1)
    .map((call) => call.value);
}

type FormUpdater = (form: Partial<ListingFormData>) => Partial<ListingFormData>;

function formUpdaters(): FormUpdater[] {
  // The form setters in this hook always pass an updater function to setForm.
  return hookState.setterCalls
    .filter((call) => call.index === 2)
    .map((call) => call.value as FormUpdater);
}

describe("useListingFormSubmit", () => {
  beforeEach(() => {
    hookState.callCount = 0;
    hookState.overrides.clear();
    hookState.refCallCount = 0;
    hookState.refOverrides.clear();
    hookState.setterCalls.length = 0;
    mockCreateListing.mockReset();
    mockCreateListing.mockResolvedValue({});
    mockPush.mockReset();
    mockUnstableRethrow.mockReset();
    mockUnstableRethrow.mockImplementation(() => undefined);
    mockUpdateListing.mockReset();
    mockUpdateListing.mockResolvedValue({});
  });

  it("skips updateListing and returns to the dashboard for no-op edits", async () => {
    const initial = makeInitialForm();
    const resolveUploadFile = vi.fn();

    const submit = useListingFormSubmit({
      initial,
      listingId: LISTING_ID,
      slots: [makeSlot()],
      resolveUploadFile,
    });

    await submit.handleSubmit();

    expect(mockUpdateListing).not.toHaveBeenCalled();
    expect(mockCreateListing).not.toHaveBeenCalled();
    expect(resolveUploadFile).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledOnce();
    expect(mockPush).toHaveBeenCalledWith("/dashboard");
    expect(submit.loading).toBe(false);
    expect(loadingSetterValues()).toEqual([]);
  });

  it("calls updateListing with expected FormData when edit fields change", async () => {
    const initial = makeInitialForm();
    hookState.refOverrides.set(0, {
      ...initial,
      contact_phone: "5551112222",
    });
    hookState.overrides.set(2, {
      ...initial,
      title: "Updated Gown",
      contact_phone: "5551112222",
    });
    const resolveUploadFile = vi.fn();

    const submit = useListingFormSubmit({
      initial,
      listingId: LISTING_ID,
      slots: [makeSlot()],
      resolveUploadFile,
    });

    await submit.handleSubmit();

    const updateCall = mockUpdateListing.mock.calls[0];
    const formData = updateCall?.[1];

    expect(mockUpdateListing).toHaveBeenCalledOnce();
    expect(updateCall?.[0]).toBe(LISTING_ID);
    expect(formData).toBeInstanceOf(FormData);
    if (!(formData instanceof FormData)) {
      throw new Error("Expected updateListing to receive FormData.");
    }
    expect(formData.get("title")).toBe("Updated Gown");
    expect(formData.get("description")).toBe("Original description");
    expect(formData.get("price")).toBe("800");
    expect(formData.get("contact_phone")).toBe("5551112222");
    expect(formData.get("existing_url_0")).toBe(EXISTING_URL);
    expect(formData.get("blur_0")).toBe(BLUR_DATA_URL);
    expect(resolveUploadFile).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(loadingSetterValues()).toEqual([true, false]);
  });

  it("rethrows NEXT_REDIRECT from updateListing through unstable_rethrow", async () => {
    const initial = makeInitialForm();
    const redirectError = new Error("NEXT_REDIRECT");
    hookState.refOverrides.set(0, {
      ...initial,
      contact_phone: "5551112222",
    });
    hookState.overrides.set(2, {
      ...initial,
      title: "Updated Gown",
      contact_phone: "5551112222",
    });
    mockUpdateListing.mockRejectedValue(redirectError);
    mockUnstableRethrow.mockImplementation((error: unknown) => {
      throw error;
    });

    const submit = useListingFormSubmit({
      initial,
      listingId: LISTING_ID,
      slots: [makeSlot()],
      resolveUploadFile: vi.fn(),
    });

    await expect(submit.handleSubmit()).rejects.toBe(redirectError);

    expect(mockUnstableRethrow).toHaveBeenCalledOnce();
    expect(mockUnstableRethrow).toHaveBeenCalledWith(redirectError);
    expect(errorSetterValues()).toEqual([""]);
    expect(loadingSetterValues()).toEqual([true, false]);
  });

  describe("create (no listingId)", () => {
    it("calls createListing with FormData built from a valid form", async () => {
      hookState.overrides.set(2, makeValidForm());
      const slot = makeSlot();
      const resolveUploadFile = vi.fn();

      const submit = useListingFormSubmit({ slots: [slot], resolveUploadFile });

      await submit.handleSubmit();

      const formData = mockCreateListing.mock.calls[0]?.[0];

      expect(mockCreateListing).toHaveBeenCalledOnce();
      expect(mockUpdateListing).not.toHaveBeenCalled();
      expect(formData).toBeInstanceOf(FormData);
      if (!(formData instanceof FormData)) {
        throw new Error("Expected createListing to receive FormData.");
      }
      expect(formData.get("title")).toBe("Valid Gown");
      expect(formData.get("description")).toBe("A lovely gown");
      expect(formData.get("size")).toBe("8");
      expect(formData.get("size_group")).toBe("adult");
      expect(formData.get("color")).toBe("Ivory");
      expect(formData.get("location")).toBe("Borough Park");
      expect(formData.get("condition")).toBe("Brand New");
      expect(formData.get("category")).toBe("bridal");
      expect(formData.get("price")).toBe("800");
      expect(formData.get("contact_email")).toBe("seller@example.com");
      expect(formData.get("contact_phone")).toBe("5551112222");
      expect(formData.get("status")).toBe("active");
      expect(formData.get("existing_url_0")).toBe(EXISTING_URL);
      expect(formData.get("blur_0")).toBe(BLUR_DATA_URL);
      expect(formData.get("image_file_0")).toBeNull();
      expect(resolveUploadFile).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
      expect(errorSetterValues()).toEqual([""]);
      expect(loadingSetterValues()).toEqual([true, false]);
    });

    it("trims text fields and falls back to empty optional values", async () => {
      hookState.overrides.set(2, {
        ...makeValidForm(),
        title: "  Spacious Gown  ",
        description: undefined,
        color: undefined,
        contact_email: "  seller@example.com  ",
        contact_phone: "",
      });

      const submit = useListingFormSubmit({
        slots: [makeSlot()],
        resolveUploadFile: vi.fn(),
      });

      await submit.handleSubmit();

      const formData = mockCreateListing.mock.calls[0]?.[0];
      if (!(formData instanceof FormData)) {
        throw new Error("Expected createListing to receive FormData.");
      }
      expect(formData.get("title")).toBe("Spacious Gown");
      expect(formData.get("description")).toBe("");
      expect(formData.get("color")).toBe("");
      expect(formData.get("contact_email")).toBe("seller@example.com");
      expect(formData.get("contact_phone")).toBe("");
    });

    it("defaults status to active when the form has no status", async () => {
      hookState.overrides.set(2, { ...makeValidForm(), status: undefined });

      const submit = useListingFormSubmit({
        slots: [makeSlot()],
        resolveUploadFile: vi.fn(),
      });

      await submit.handleSubmit();

      const formData = mockCreateListing.mock.calls[0]?.[0];
      if (!(formData instanceof FormData)) {
        throw new Error("Expected createListing to receive FormData.");
      }
      expect(formData.get("status")).toBe("active");
    });

    it("surfaces the action error when createListing returns one", async () => {
      hookState.overrides.set(2, makeValidForm());
      mockCreateListing.mockResolvedValue({ error: "Database is down." });

      const submit = useListingFormSubmit({
        slots: [makeSlot()],
        resolveUploadFile: vi.fn(),
      });

      await submit.handleSubmit();

      expect(mockPush).not.toHaveBeenCalled();
      expect(errorSetterValues()).toEqual(["", "Database is down."]);
      expect(loadingSetterValues()).toEqual([true, false]);
    });

    it("shows a generic message when the action rejects with a non-Error", async () => {
      hookState.overrides.set(2, makeValidForm());
      mockCreateListing.mockRejectedValue("kaboom");

      const submit = useListingFormSubmit({
        slots: [makeSlot()],
        resolveUploadFile: vi.fn(),
      });

      await submit.handleSubmit();

      expect(mockUnstableRethrow).toHaveBeenCalledWith("kaboom");
      expect(errorSetterValues()).toEqual(["", "Something went wrong."]);
      expect(loadingSetterValues()).toEqual([true, false]);
    });
  });

  describe("validation", () => {
    const invalidCases: Array<[string, Record<string, unknown>]> = [
      ["title is blank", { title: "   " }],
      ["size is empty", { size: "" }],
      ["size_group is missing", { size_group: undefined }],
      ["location is empty", { location: "" }],
      ["condition is missing", { condition: undefined }],
      ["price is null", { price: undefined }],
      ["price is NaN", { price: NaN }],
      ["contact_email is blank", { contact_email: "  " }],
      ["category is missing", { category: null }],
      ["category is not a known category", { category: "spacesuit" }],
    ];

    it.each(invalidCases)(
      "rejects and sets an error when %s",
      async (_label, patch) => {
        hookState.overrides.set(2, { ...makeValidForm(), ...patch });
        const resolveUploadFile = vi.fn();

        const submit = useListingFormSubmit({
          slots: [makeSlot()],
          resolveUploadFile,
        });

        await submit.handleSubmit();

        expect(mockCreateListing).not.toHaveBeenCalled();
        expect(mockUpdateListing).not.toHaveBeenCalled();
        expect(resolveUploadFile).not.toHaveBeenCalled();
        expect(errorSetterValues()).toEqual([
          "",
          "Please fill in all required fields.",
        ]);
        expect(loadingSetterValues()).toEqual([true, false]);
      },
    );

    it("rejects when no slot has a file or existing image", async () => {
      hookState.overrides.set(2, makeValidForm());
      const emptySlot = makeSlot({ existingUrl: null, imageFile: null });
      const resolveUploadFile = vi.fn();

      const submit = useListingFormSubmit({
        slots: [emptySlot],
        resolveUploadFile,
      });

      await submit.handleSubmit();

      expect(mockCreateListing).not.toHaveBeenCalled();
      expect(resolveUploadFile).not.toHaveBeenCalled();
      expect(errorSetterValues()).toEqual([
        "",
        "Please add at least one gown photo.",
      ]);
      expect(loadingSetterValues()).toEqual([true, false]);
    });
  });

  describe("image payloads", () => {
    it("resolves and attaches a newly uploaded file", async () => {
      hookState.overrides.set(2, makeValidForm());
      const file = new File(["x"], "gown.webp", { type: "image/webp" });
      const slot = makeSlot({ imageFile: file, existingUrl: null });
      const resolveUploadFile = vi.fn().mockResolvedValue(file);

      const submit = useListingFormSubmit({ slots: [slot], resolveUploadFile });

      await submit.handleSubmit();

      expect(resolveUploadFile).toHaveBeenCalledOnce();
      expect(resolveUploadFile).toHaveBeenCalledWith(slot);

      const formData = mockCreateListing.mock.calls[0]?.[0];
      if (!(formData instanceof FormData)) {
        throw new Error("Expected createListing to receive FormData.");
      }
      expect(formData.get("image_file_0")).toBeInstanceOf(File);
      expect(formData.get("existing_url_0")).toBeNull();
      expect(formData.get("blur_0")).toBe(BLUR_DATA_URL);
    });

    it("attaches a file for new slots and a url for existing ones", async () => {
      hookState.overrides.set(2, makeValidForm());
      const file = new File(["x"], "new.webp", { type: "image/webp" });
      const newSlot = makeSlot({
        id: "slot-0",
        imageFile: file,
        existingUrl: null,
      });
      const existingSlot = makeSlot({
        id: "slot-1",
        existingUrl: SECOND_URL,
        preview: SECOND_URL,
      });
      const resolveUploadFile = vi.fn().mockResolvedValue(file);

      const submit = useListingFormSubmit({
        slots: [newSlot, existingSlot],
        resolveUploadFile,
      });

      await submit.handleSubmit();

      const formData = mockCreateListing.mock.calls[0]?.[0];
      if (!(formData instanceof FormData)) {
        throw new Error("Expected createListing to receive FormData.");
      }
      expect(resolveUploadFile).toHaveBeenCalledTimes(1);
      expect(formData.get("image_file_0")).toBeInstanceOf(File);
      expect(formData.get("existing_url_0")).toBeNull();
      expect(formData.get("image_file_1")).toBeNull();
      expect(formData.get("existing_url_1")).toBe(SECOND_URL);
    });

    it("writes an empty blur string when the blur promise resolves null", async () => {
      hookState.overrides.set(2, makeValidForm());
      const slot = makeSlot({ blurPromise: Promise.resolve(null) });

      const submit = useListingFormSubmit({
        slots: [slot],
        resolveUploadFile: vi.fn(),
      });

      await submit.handleSubmit();

      const formData = mockCreateListing.mock.calls[0]?.[0];
      if (!(formData instanceof FormData)) {
        throw new Error("Expected createListing to receive FormData.");
      }
      expect(formData.get("blur_0")).toBe("");
    });
  });

  describe("edit triggered by image changes only", () => {
    it("calls updateListing when existing images are reordered", async () => {
      const initial = makeInitialForm();
      hookState.refOverrides.set(1, [EXISTING_URL, SECOND_URL]);
      const resolveUploadFile = vi.fn();

      const submit = useListingFormSubmit({
        initial,
        listingId: LISTING_ID,
        slots: [
          makeSlot({ id: "slot-0", existingUrl: SECOND_URL, preview: SECOND_URL }),
          makeSlot({ id: "slot-1", existingUrl: EXISTING_URL }),
        ],
        resolveUploadFile,
      });

      await submit.handleSubmit();

      const formData = mockUpdateListing.mock.calls[0]?.[1];
      if (!(formData instanceof FormData)) {
        throw new Error("Expected updateListing to receive FormData.");
      }
      expect(mockUpdateListing).toHaveBeenCalledOnce();
      expect(formData.get("existing_url_0")).toBe(SECOND_URL);
      expect(formData.get("existing_url_1")).toBe(EXISTING_URL);
      expect(resolveUploadFile).not.toHaveBeenCalled();
    });

    it("calls updateListing when an existing image is removed", async () => {
      const initial = makeInitialForm();
      hookState.refOverrides.set(1, [EXISTING_URL, SECOND_URL]);

      const submit = useListingFormSubmit({
        initial,
        listingId: LISTING_ID,
        slots: [makeSlot({ id: "slot-0", existingUrl: EXISTING_URL })],
        resolveUploadFile: vi.fn(),
      });

      await submit.handleSubmit();

      expect(mockUpdateListing).toHaveBeenCalledOnce();
      expect(mockCreateListing).not.toHaveBeenCalled();
    });
  });

  describe("form setters", () => {
    it("setField sets string and numeric fields", () => {
      const submit = useListingFormSubmit({
        slots: [makeSlot()],
        resolveUploadFile: vi.fn(),
      });

      submit.setField("title", "New Title");
      submit.setField("price", 950);

      const [setTitle, setPrice] = formUpdaters();
      expect(setTitle({ title: "old" })).toEqual({ title: "New Title" });
      expect(setPrice({ price: 1 })).toEqual({ price: 950 });
    });

    it("setSizeSelection sets size and size_group together", () => {
      const submit = useListingFormSubmit({
        slots: [makeSlot()],
        resolveUploadFile: vi.fn(),
      });

      submit.setSizeSelection({ size: "10", sizeGroup: "adult" });

      const [update] = formUpdaters();
      expect(update({})).toEqual({ size: "10", size_group: "adult" });
    });

    it("setCategory keeps a size that is still valid for the new category", () => {
      const submit = useListingFormSubmit({
        slots: [makeSlot()],
        resolveUploadFile: vi.fn(),
      });

      submit.setCategory("bridal");

      const [update] = formUpdaters();
      expect(update({ size: "8", size_group: "adult" })).toEqual({
        category: "bridal",
        size: "8",
        size_group: "adult",
      });
    });

    it("setCategory clears a size that is invalid for the new category", () => {
      const submit = useListingFormSubmit({
        slots: [makeSlot()],
        resolveUploadFile: vi.fn(),
      });

      submit.setCategory("bridal");

      const [update] = formUpdaters();
      expect(update({ size: "8", size_group: "kids" })).toEqual({
        category: "bridal",
        size: "",
        size_group: undefined,
      });
    });

    it("setCategory normalizes an unknown category to null and clears the size", () => {
      const submit = useListingFormSubmit({
        slots: [makeSlot()],
        resolveUploadFile: vi.fn(),
      });

      submit.setCategory("spacesuit");

      const [update] = formUpdaters();
      expect(update({ size: "8", size_group: "adult" })).toEqual({
        category: null,
        size: "",
        size_group: undefined,
      });
    });

    it("setContactPhone strips formatting to digits only", () => {
      const submit = useListingFormSubmit({
        slots: [makeSlot()],
        resolveUploadFile: vi.fn(),
      });

      submit.setContactPhone("(555) 123-4567");
      submit.setContactPhone("");
      submit.setContactPhone("no-digits-here");

      const [formatted, emptied, letters] = formUpdaters();
      expect(formatted({})).toEqual({ contact_phone: "5551234567" });
      expect(emptied({})).toEqual({ contact_phone: "" });
      expect(letters({})).toEqual({ contact_phone: "" });
    });
  });
});
