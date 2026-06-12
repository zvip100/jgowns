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

describe("useListingFormSubmit", () => {
  beforeEach(() => {
    hookState.callCount = 0;
    hookState.overrides.clear();
    hookState.refCallCount = 0;
    hookState.refOverrides.clear();
    hookState.setterCalls.length = 0;
    mockCreateListing.mockReset();
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
});
