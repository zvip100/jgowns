import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ImageSlotState,
  ListingFormData,
  ListingSizeRowState,
} from "@/lib/types";

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

import {
  deriveSellMode,
  useListingFormSubmit,
} from "@/hooks/useListingFormSubmit";

const LISTING_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const EXISTING_URL = "https://example.com/existing.webp";
const SECOND_URL = "https://example.com/second.webp";
const BLUR_DATA_URL = "data:image/jpeg;base64,blur";

// useState order in the hook: 0 loading, 1 error, 2 form, 3 sizeRows,
// 4 sellOnlyAsSet, 5 bundlePrice, 6 contactMethods. useRef order:
// 0 initialFormRef, 1 initialSizeSnapshotRef, 2 originalImageUrlsRef,
// 3 initialContactMethodsRef.
const STATE_FORM = 2;
const STATE_ROWS = 3;
const STATE_SELL_ONLY_AS_SET = 4;
const STATE_BUNDLE_PRICE = 5;
const STATE_CONTACT_METHODS = 6;
const REF_INITIAL_FORM = 0;
const REF_INITIAL_SIZE_SNAPSHOT = 1;
const REF_ORIGINAL_IMAGE_URLS = 2;

const INITIAL_SIZES = [{ size: "8", size_group: "adult" as const, price: 800 }];

function makeInitialForm(): Partial<ListingFormData> {
  return {
    title: "Original Gown",
    description: "Original description",
    color: "Ivory",
    location: "Borough Park",
    condition: "Brand New",
    category: "bridal",
    sizes: INITIAL_SIZES,
    sell_mode: "individual",
    bundle_price: null,
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
    color: "Ivory",
    location: "Borough Park",
    condition: "Brand New",
    category: "bridal",
    contact_email: "seller@example.com",
    contact_phone: "5551112222",
    status: "active",
  };
}

function makeValidRows(): ListingSizeRowState[] {
  return [{ key: "row-0", size: "8", size_group: "adult", price: "800" }];
}

function makeTwoRows(): ListingSizeRowState[] {
  return [
    { key: "row-0", size: "8", size_group: "adult", price: "800" },
    { key: "row-1", size: "10", size_group: "adult", price: "850" },
  ];
}

function setValidCreateState(formPatch: Record<string, unknown> = {}) {
  hookState.overrides.set(STATE_FORM, { ...makeValidForm(), ...formPatch });
  hookState.overrides.set(STATE_ROWS, makeValidRows());
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

type FormState = Partial<Omit<ListingFormData, "sizes">>;
type FormUpdater = (form: FormState) => FormState;
type RowsUpdater = (rows: ListingSizeRowState[]) => ListingSizeRowState[];

function formUpdaters(): FormUpdater[] {
  // The form setters in this hook always pass an updater function to setForm.
  return hookState.setterCalls
    .filter((call) => call.index === STATE_FORM)
    .map((call) => call.value as FormUpdater);
}

function rowSetterValues(): unknown[] {
  return hookState.setterCalls
    .filter((call) => call.index === STATE_ROWS)
    .map((call) => call.value);
}

type ContactMethodsUpdater = (current: string[]) => string[];

function contactMethodsSetterValues(): unknown[] {
  return hookState.setterCalls
    .filter((call) => call.index === STATE_CONTACT_METHODS)
    .map((call) => call.value);
}

describe("deriveSellMode", () => {
  it("returns individual for a single size regardless of flags", () => {
    expect(deriveSellMode(1, true, "500")).toBe("individual");
    expect(deriveSellMode(1, false, "")).toBe("individual");
  });

  it("returns set_only when the checkbox is on with 2+ sizes", () => {
    expect(deriveSellMode(2, true, "")).toBe("set_only");
    expect(deriveSellMode(3, true, "900")).toBe("set_only");
  });

  it("returns either when a bundle price is entered without the checkbox", () => {
    expect(deriveSellMode(2, false, "1200")).toBe("either");
  });

  it("returns individual for 2+ sizes with no checkbox and no bundle price", () => {
    expect(deriveSellMode(2, false, "")).toBe("individual");
    expect(deriveSellMode(2, false, "   ")).toBe("individual");
  });
});

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
    hookState.refOverrides.set(REF_INITIAL_FORM, {
      ...initial,
      contact_phone: "5551112222",
    });
    hookState.overrides.set(STATE_FORM, {
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
    expect(formData.get("sizes")).toBe(JSON.stringify(INITIAL_SIZES));
    expect(formData.get("sell_mode")).toBe("individual");
    expect(formData.get("bundle_price")).toBe("");
    expect(formData.get("contact_phone")).toBe("5551112222");
    expect(formData.get("existing_url_0")).toBe(EXISTING_URL);
    expect(formData.get("blur_0")).toBe(BLUR_DATA_URL);
    expect(resolveUploadFile).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(loadingSetterValues()).toEqual([true, false]);
  });

  it("calls updateListing when only the size rows change", async () => {
    const initial = makeInitialForm();
    hookState.overrides.set(STATE_ROWS, [
      { key: "row-0", size: "8", size_group: "adult", price: "900" },
    ]);
    // The mocked useState override also feeds the snapshot ref initializer,
    // so pin the ref to the true initial snapshot (price 800, not 900).
    hookState.refOverrides.set(
      REF_INITIAL_SIZE_SNAPSHOT,
      JSON.stringify({
        rows: [["adult", "8", "800"]],
        sellOnlyAsSet: false,
        bundlePrice: "",
      }),
    );

    const submit = useListingFormSubmit({
      initial,
      listingId: LISTING_ID,
      slots: [makeSlot()],
      resolveUploadFile: vi.fn(),
    });

    await submit.handleSubmit();

    expect(mockUpdateListing).toHaveBeenCalledOnce();
    const formData = mockUpdateListing.mock.calls[0]?.[1];
    if (!(formData instanceof FormData)) {
      throw new Error("Expected updateListing to receive FormData.");
    }
    expect(formData.get("sizes")).toBe(
      JSON.stringify([{ size: "8", size_group: "adult", price: 900 }]),
    );
  });

  it("rethrows NEXT_REDIRECT from updateListing through unstable_rethrow", async () => {
    const initial = makeInitialForm();
    const redirectError = new Error("NEXT_REDIRECT");
    hookState.refOverrides.set(REF_INITIAL_FORM, {
      ...initial,
      contact_phone: "5551112222",
    });
    hookState.overrides.set(STATE_FORM, {
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
      setValidCreateState();
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
      expect(formData.get("sizes")).toBe(
        JSON.stringify([{ size: "8", size_group: "adult", price: 800 }]),
      );
      expect(formData.get("sell_mode")).toBe("individual");
      expect(formData.get("bundle_price")).toBe("");
      expect(formData.get("color")).toBe("Ivory");
      expect(formData.get("location")).toBe("Borough Park");
      expect(formData.get("condition")).toBe("Brand New");
      expect(formData.get("category")).toBe("bridal");
      expect(formData.get("contact_email")).toBe("seller@example.com");
      expect(formData.get("contact_phone")).toBe("5551112222");
      expect(formData.get("contact_methods")).toBe("[]");
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
      setValidCreateState({
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

    it("serializes selected contact methods into FormData", async () => {
      setValidCreateState({ contact_phone: "5551234567" });
      hookState.overrides.set(STATE_CONTACT_METHODS, ["call", "text"]);

      const submit = useListingFormSubmit({
        slots: [makeSlot()],
        resolveUploadFile: vi.fn(),
      });

      await submit.handleSubmit();

      const formData = mockCreateListing.mock.calls[0]?.[0];
      if (!(formData instanceof FormData)) {
        throw new Error("Expected createListing to receive FormData.");
      }
      expect(formData.get("contact_methods")).toBe(
        JSON.stringify(["call", "text"]),
      );
    });

    it("defaults status to active when the form has no status", async () => {
      setValidCreateState({ status: undefined });

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
      setValidCreateState();
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
      setValidCreateState();
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

  describe("derived sell_mode serialization", () => {
    it("serializes set_only with the bundle price when the checkbox is on", async () => {
      setValidCreateState();
      hookState.overrides.set(STATE_ROWS, makeTwoRows());
      hookState.overrides.set(STATE_SELL_ONLY_AS_SET, true);
      hookState.overrides.set(STATE_BUNDLE_PRICE, "1500");

      const submit = useListingFormSubmit({
        slots: [makeSlot()],
        resolveUploadFile: vi.fn(),
      });

      await submit.handleSubmit();

      const formData = mockCreateListing.mock.calls[0]?.[0];
      if (!(formData instanceof FormData)) {
        throw new Error("Expected createListing to receive FormData.");
      }
      expect(formData.get("sell_mode")).toBe("set_only");
      expect(formData.get("bundle_price")).toBe("1500");
      // Set-only omits per-size prices — the server stamps the set price.
      expect(formData.get("sizes")).toBe(
        JSON.stringify([
          { size: "8", size_group: "adult" },
          { size: "10", size_group: "adult" },
        ]),
      );
    });

    it("serializes either when a discounted bundle price is entered", async () => {
      setValidCreateState();
      hookState.overrides.set(STATE_ROWS, makeTwoRows());
      hookState.overrides.set(STATE_BUNDLE_PRICE, "1500");

      const submit = useListingFormSubmit({
        slots: [makeSlot()],
        resolveUploadFile: vi.fn(),
      });

      await submit.handleSubmit();

      const formData = mockCreateListing.mock.calls[0]?.[0];
      if (!(formData instanceof FormData)) {
        throw new Error("Expected createListing to receive FormData.");
      }
      expect(formData.get("sell_mode")).toBe("either");
      expect(formData.get("bundle_price")).toBe("1500");
    });

    it("serializes individual with no bundle price for plain multi-size rows", async () => {
      setValidCreateState();
      hookState.overrides.set(STATE_ROWS, makeTwoRows());

      const submit = useListingFormSubmit({
        slots: [makeSlot()],
        resolveUploadFile: vi.fn(),
      });

      await submit.handleSubmit();

      const formData = mockCreateListing.mock.calls[0]?.[0];
      if (!(formData instanceof FormData)) {
        throw new Error("Expected createListing to receive FormData.");
      }
      expect(formData.get("sell_mode")).toBe("individual");
      expect(formData.get("bundle_price")).toBe("");
    });
  });

  describe("validation", () => {
    const invalidCases: Array<[string, Record<string, unknown>]> = [
      ["title is blank", { title: "   " }],
      ["location is empty", { location: "" }],
      ["condition is missing", { condition: undefined }],
      ["category is missing", { category: null }],
      ["category is not a known category", { category: "spacesuit" }],
    ];

    it.each(invalidCases)(
      "rejects and sets an error when %s",
      async (_label, patch) => {
        setValidCreateState(patch);
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

    const invalidRowCases: Array<[string, ListingSizeRowState[], string]> = [
      [
        "a row has no size",
        [{ key: "row-0", size: "", size_group: null, price: "800" }],
        "Choose a size for every row.",
      ],
      [
        "a row has no price",
        [{ key: "row-0", size: "8", size_group: "adult", price: "" }],
        "Enter a price for every size.",
      ],
      [
        "a row has a non-positive price",
        [{ key: "row-0", size: "8", size_group: "adult", price: "0" }],
        "Enter a price for every size.",
      ],
      [
        "two rows repeat the same size",
        [
          { key: "row-0", size: "8", size_group: "adult", price: "800" },
          { key: "row-1", size: "8", size_group: "adult", price: "850" },
        ],
        "Each size can only be added once.",
      ],
    ];

    it.each(invalidRowCases)(
      "rejects and sets an error when %s",
      async (_label, rows, message) => {
        setValidCreateState();
        hookState.overrides.set(STATE_ROWS, rows);

        const submit = useListingFormSubmit({
          slots: [makeSlot()],
          resolveUploadFile: vi.fn(),
        });

        await submit.handleSubmit();

        expect(mockCreateListing).not.toHaveBeenCalled();
        expect(errorSetterValues()).toEqual(["", message]);
      },
    );

    it("rejects when neither an email nor a phone is provided", async () => {
      setValidCreateState({ contact_email: "  ", contact_phone: "" });
      const resolveUploadFile = vi.fn();

      const submit = useListingFormSubmit({
        slots: [makeSlot()],
        resolveUploadFile,
      });

      await submit.handleSubmit();

      expect(mockCreateListing).not.toHaveBeenCalled();
      expect(resolveUploadFile).not.toHaveBeenCalled();
      expect(errorSetterValues()).toEqual([
        "",
        "Add an email or phone number so buyers can reach you.",
      ]);
    });

    it("accepts a phone-only form with a blank email", async () => {
      setValidCreateState({ contact_email: "", contact_phone: "5551234567" });

      const submit = useListingFormSubmit({
        slots: [makeSlot()],
        resolveUploadFile: vi.fn(),
      });

      await submit.handleSubmit();

      const formData = mockCreateListing.mock.calls[0]?.[0];
      if (!(formData instanceof FormData)) {
        throw new Error("Expected createListing to receive FormData.");
      }
      expect(formData.get("contact_email")).toBe("");
      expect(formData.get("contact_phone")).toBe("5551234567");
    });

    it("rejects set_only with no set price", async () => {
      setValidCreateState();
      hookState.overrides.set(STATE_ROWS, makeTwoRows());
      hookState.overrides.set(STATE_SELL_ONLY_AS_SET, true);

      const submit = useListingFormSubmit({
        slots: [makeSlot()],
        resolveUploadFile: vi.fn(),
      });

      await submit.handleSubmit();

      expect(mockCreateListing).not.toHaveBeenCalled();
      expect(errorSetterValues()).toEqual([
        "",
        "Enter the price for the complete set.",
      ]);
    });

    it("rejects an 'either' bundle price that is not a discount", async () => {
      setValidCreateState();
      hookState.overrides.set(STATE_ROWS, makeTwoRows());
      hookState.overrides.set(STATE_BUNDLE_PRICE, "1650");

      const submit = useListingFormSubmit({
        slots: [makeSlot()],
        resolveUploadFile: vi.fn(),
      });

      await submit.handleSubmit();

      expect(mockCreateListing).not.toHaveBeenCalled();
      expect(errorSetterValues()).toEqual([
        "",
        "The price for all sizes together should be less than the sizes priced individually.",
      ]);
    });

    it("rejects when no slot has a file or existing image", async () => {
      setValidCreateState();
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
      setValidCreateState();
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
      setValidCreateState();
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
      setValidCreateState();
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
      hookState.refOverrides.set(REF_ORIGINAL_IMAGE_URLS, [
        EXISTING_URL,
        SECOND_URL,
      ]);
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
      hookState.refOverrides.set(REF_ORIGINAL_IMAGE_URLS, [
        EXISTING_URL,
        SECOND_URL,
      ]);

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
    it("setField sets scalar fields", () => {
      const submit = useListingFormSubmit({
        slots: [makeSlot()],
        resolveUploadFile: vi.fn(),
      });

      submit.setField("title", "New Title");
      submit.setField("location", "Monsey");

      const [setTitle, setLocation] = formUpdaters();
      expect(setTitle({ title: "old" })).toEqual({ title: "New Title" });
      expect(setLocation({ location: "Lakewood" })).toEqual({
        location: "Monsey",
      });
    });

    it("setCategory sets the category and keeps still-valid row sizes", () => {
      hookState.overrides.set(STATE_ROWS, makeValidRows());
      const submit = useListingFormSubmit({
        slots: [makeSlot()],
        resolveUploadFile: vi.fn(),
      });

      submit.setCategory("bridal");

      const [formUpdate] = formUpdaters();
      expect(formUpdate({})).toEqual({ category: "bridal" });

      const [rowsUpdate] = rowSetterValues() as RowsUpdater[];
      expect(
        rowsUpdate([{ key: "row-0", size: "8", size_group: "adult", price: "800" }]),
      ).toEqual([{ key: "row-0", size: "8", size_group: "adult", price: "800" }]);
    });

    it("setCategory clears row sizes that are invalid for the new category", () => {
      const submit = useListingFormSubmit({
        slots: [makeSlot()],
        resolveUploadFile: vi.fn(),
      });

      submit.setCategory("bridal");

      const [rowsUpdate] = rowSetterValues() as RowsUpdater[];
      expect(
        rowsUpdate([{ key: "row-0", size: "8", size_group: "kids", price: "800" }]),
      ).toEqual([{ key: "row-0", size: "", size_group: null, price: "800" }]);
    });

    it("setCategory normalizes an unknown category to null and clears row sizes", () => {
      const submit = useListingFormSubmit({
        slots: [makeSlot()],
        resolveUploadFile: vi.fn(),
      });

      submit.setCategory("spacesuit");

      const [formUpdate] = formUpdaters();
      expect(formUpdate({})).toEqual({ category: null });

      const [rowsUpdate] = rowSetterValues() as RowsUpdater[];
      expect(
        rowsUpdate([{ key: "row-0", size: "8", size_group: "adult", price: "800" }]),
      ).toEqual([{ key: "row-0", size: "", size_group: null, price: "800" }]);
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

    it("setContactPhone clears contact methods when the phone is emptied", () => {
      const submit = useListingFormSubmit({
        slots: [makeSlot()],
        resolveUploadFile: vi.fn(),
      });

      submit.setContactPhone("(555) 123-4567");
      submit.setContactPhone("");

      // Only the empty call clears methods; the digit-bearing call leaves them.
      expect(contactMethodsSetterValues()).toEqual([[]]);
    });

    it("toggleContactMethod adds without duplicating and removes a method", () => {
      const submit = useListingFormSubmit({
        slots: [makeSlot()],
        resolveUploadFile: vi.fn(),
      });

      submit.toggleContactMethod("call", true);
      submit.toggleContactMethod("text", false);

      const [add, remove] =
        contactMethodsSetterValues() as ContactMethodsUpdater[];
      expect(add([])).toEqual(["call"]);
      expect(add(["call"])).toEqual(["call"]);
      expect(remove(["call", "text"])).toEqual(["call"]);
    });
  });

  describe("size row controls", () => {
    it("updateRow patches only the matching row", () => {
      hookState.overrides.set(STATE_ROWS, makeTwoRows());
      const submit = useListingFormSubmit({
        slots: [makeSlot()],
        resolveUploadFile: vi.fn(),
      });

      submit.sizesController.updateRow("row-1", { price: "999" });

      const [rowsUpdate] = rowSetterValues() as RowsUpdater[];
      expect(rowsUpdate(makeTwoRows())).toEqual([
        { key: "row-0", size: "8", size_group: "adult", price: "800" },
        { key: "row-1", size: "10", size_group: "adult", price: "999" },
      ]);
    });

    it("addRow appends an empty row", () => {
      const submit = useListingFormSubmit({
        slots: [makeSlot()],
        resolveUploadFile: vi.fn(),
      });

      submit.sizesController.addRow();

      const [rowsUpdate] = rowSetterValues() as RowsUpdater[];
      const next = rowsUpdate(makeValidRows());
      expect(next).toHaveLength(2);
      expect(next[1]).toMatchObject({ size: "", size_group: null, price: "" });
    });

    it("removeRow drops the row and clears set pricing when one row remains", () => {
      hookState.overrides.set(STATE_ROWS, makeTwoRows());
      hookState.overrides.set(STATE_SELL_ONLY_AS_SET, true);
      hookState.overrides.set(STATE_BUNDLE_PRICE, "1500");
      const submit = useListingFormSubmit({
        slots: [makeSlot()],
        resolveUploadFile: vi.fn(),
      });

      submit.sizesController.removeRow("row-1");

      const rowsValues = rowSetterValues();
      expect(rowsValues).toEqual([
        [{ key: "row-0", size: "8", size_group: "adult", price: "800" }],
      ]);
      const setOnlyCalls = hookState.setterCalls.filter(
        (call) => call.index === STATE_SELL_ONLY_AS_SET,
      );
      const bundleCalls = hookState.setterCalls.filter(
        (call) => call.index === STATE_BUNDLE_PRICE,
      );
      expect(setOnlyCalls.map((c) => c.value)).toEqual([false]);
      expect(bundleCalls.map((c) => c.value)).toEqual([""]);
    });

    it("removeRow refuses to drop the last remaining row", () => {
      const submit = useListingFormSubmit({
        slots: [makeSlot()],
        resolveUploadFile: vi.fn(),
      });

      submit.sizesController.removeRow("row-0");

      expect(rowSetterValues()).toEqual([]);
    });

    it("unchecking 'set only' leaves the per-size prices intact", () => {
      hookState.overrides.set(STATE_ROWS, makeTwoRows());
      const submit = useListingFormSubmit({
        slots: [makeSlot()],
        resolveUploadFile: vi.fn(),
      });

      submit.sizesController.setSellOnlyAsSet(false);

      const setOnlyCalls = hookState.setterCalls.filter(
        (call) => call.index === STATE_SELL_ONLY_AS_SET,
      );
      expect(setOnlyCalls.map((c) => c.value)).toEqual([false]);
      expect(rowSetterValues()).toEqual([]);
    });

    it("checking 'set only' leaves the size rows untouched", () => {
      const submit = useListingFormSubmit({
        slots: [makeSlot()],
        resolveUploadFile: vi.fn(),
      });

      submit.sizesController.setSellOnlyAsSet(true);

      const setOnlyCalls = hookState.setterCalls.filter(
        (call) => call.index === STATE_SELL_ONLY_AS_SET,
      );
      expect(setOnlyCalls.map((c) => c.value)).toEqual([true]);
      expect(rowSetterValues()).toEqual([]);
    });
  });
});
