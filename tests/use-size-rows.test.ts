import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ListingSizeRowState } from "@/lib/types";

type RowsUpdater = (rows: ListingSizeRowState[]) => ListingSizeRowState[];

const { hookState } = vi.hoisted(() => ({
  hookState: {
    setterCalls: [] as { value: unknown }[],
  },
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    useCallback: <Callback>(callback: Callback): Callback => callback,
    useState: <State>(
      initial: State | (() => State),
    ): [State, (next: State | ((current: State) => State)) => void] => {
      const value =
        typeof initial === "function" ? (initial as () => State)() : initial;
      const setState = (next: State | ((current: State) => State)) => {
        hookState.setterCalls.push({ value: next });
      };
      return [value, setState];
    },
  };
});

import { useSizeRows } from "@/hooks/useSizeRows";

/**
 * `useState`/`useCallback` are mocked above so the hook can be called directly
 * as a plain function, matching the pattern in `listing-form-submit.test.ts`.
 */

function makeRow(overrides: Partial<ListingSizeRowState> = {}): ListingSizeRowState {
  return {
    key: "row-0",
    size: "8",
    size_group: "adult",
    price: "800",
    ...overrides,
  };
}

function setterValues(): unknown[] {
  return hookState.setterCalls.map((call) => call.value);
}

beforeEach(() => {
  hookState.setterCalls = [];
});

describe("useSizeRows", () => {
  it("starts from the given rows, whether passed directly or lazily", () => {
    expect(useSizeRows([makeRow()]).rows).toEqual([makeRow()]);
    expect(useSizeRows(() => [makeRow({ key: "row-9" })]).rows).toEqual([
      makeRow({ key: "row-9" }),
    ]);
  });

  it("updateRow patches only the matching row", () => {
    useSizeRows([makeRow()]).updateRow("row-0", { price: "999" });

    const [update] = setterValues() as RowsUpdater[];
    expect(
      update([makeRow(), makeRow({ key: "row-1", size: "10" })]),
    ).toEqual([
      makeRow({ price: "999" }),
      makeRow({ key: "row-1", size: "10" }),
    ]);
  });

  it("addRow appends an empty row", () => {
    useSizeRows([makeRow()]).addRow();

    const [update] = setterValues() as RowsUpdater[];
    const next = update([makeRow()]);
    expect(next).toHaveLength(2);
    expect(next[1]).toMatchObject({ size: "", size_group: null, price: "" });
  });

  it("removeRow drops the row and fires onRowsExhausted once one remains", () => {
    const onRowsExhausted = vi.fn();
    useSizeRows([makeRow(), makeRow({ key: "row-1" })], {
      onRowsExhausted,
    }).removeRow("row-1");

    const [update] = setterValues() as RowsUpdater[];
    expect(update([makeRow(), makeRow({ key: "row-1" })])).toEqual([
      makeRow(),
    ]);
    expect(onRowsExhausted).toHaveBeenCalledTimes(1);
  });

  it("removeRow refuses to drop the last row and skips onRowsExhausted", () => {
    const onRowsExhausted = vi.fn();
    useSizeRows([makeRow()], { onRowsExhausted }).removeRow("row-0");

    const [update] = setterValues() as RowsUpdater[];
    expect(update([makeRow()])).toEqual([makeRow()]);
    expect(onRowsExhausted).not.toHaveBeenCalled();
  });

  it("clearInvalidRows blanks the size/group on a row the predicate rejects", () => {
    useSizeRows([makeRow()]).clearInvalidRows(() => false);

    const [update] = setterValues() as RowsUpdater[];
    const emptyRow: ListingSizeRowState = {
      key: "row-1",
      size: "",
      size_group: null,
      price: "",
    };
    expect(update([makeRow(), emptyRow])).toEqual([
      { key: "row-0", size: "", size_group: null, price: "800" },
      emptyRow,
    ]);
  });

  it("clearInvalidRows leaves a row the predicate accepts untouched", () => {
    useSizeRows([makeRow()]).clearInvalidRows(() => true);

    const [update] = setterValues() as RowsUpdater[];
    expect(update([makeRow()])).toEqual([makeRow()]);
  });
});
