import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ReactElement } from "react";

type Manager = {
  dragOperation: { activatorEvent: unknown };
  actions: { stop: ReturnType<typeof vi.fn> };
};

type ProviderProps = {
  sensors: unknown[];
  plugins: (defaults: unknown[]) => unknown[];
  onDragStart: (event: unknown, manager: Manager) => void;
  onDragEnd: (event: unknown) => void;
  children: unknown;
};

const { accessibility, configured, cursor, effects } = vi.hoisted(() => ({
  accessibility: { name: "Accessibility" },
  configured: { name: "configured accessibility" },
  cursor: { name: "Cursor" },
  effects: [] as (() => void | (() => void))[],
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useRef: <Value,>(initial: Value) => ({ current: initial }),
    useEffect: (effect: () => void | (() => void)) => {
      effects.push(effect);
    },
  };
});
vi.mock("@dnd-kit/react", () => ({ DragDropProvider: () => null }));
vi.mock("@dnd-kit/react/sortable", () => ({
  isSortable: (source: { sortable?: boolean }) => Boolean(source?.sortable),
}));
vi.mock("@dnd-kit/dom", () => ({
  Accessibility: Object.assign(accessibility, { configure: () => configured }),
  Cursor: cursor,
  KeyboardSensor: { configure: (options: unknown) => ({ keyboard: options }) },
  PointerSensor: { configure: (options: unknown) => ({ pointer: options }) },
  PointerActivationConstraints: { Delay: class {}, Distance: class {} },
}));

import { PhotoSortProvider } from "@/components/photo-studio/PhotoSortProvider";

class FakeKeyboardEvent {}
class FakePointerEvent {}

const onMove = vi.fn();
const onDraggingChange = vi.fn();
const listeners = new Map<string, () => void>();
const fakeDocument = {
  addEventListener: vi.fn((type: string, listener: () => void) => listeners.set(type, listener)),
  removeEventListener: vi.fn((type: string) => listeners.delete(type)),
};

function providerProps(withDragging = true): ProviderProps {
  effects.length = 0;
  const element = PhotoSortProvider({
    onMove,
    onDraggingChange: withDragging ? onDraggingChange : undefined,
    children: "photos",
  }) as ReactElement<ProviderProps>;
  return element.props;
}

function manager(activatorEvent: unknown): Manager {
  return { dragOperation: { activatorEvent }, actions: { stop: vi.fn() } };
}

function dragEnd(from: number, to: number, canceled = false) {
  return { canceled, operation: { source: { sortable: true, initialIndex: from, index: to } } };
}

beforeEach(() => {
  onMove.mockReset();
  onDraggingChange.mockReset();
  listeners.clear();
  fakeDocument.addEventListener.mockClear();
  fakeDocument.removeEventListener.mockClear();
  vi.stubGlobal("document", fakeDocument);
  vi.stubGlobal("KeyboardEvent", FakeKeyboardEvent);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PhotoSortProvider", () => {
  it("renders its children inside a provider with pointer and keyboard sensors", () => {
    const props = providerProps();
    expect(props.children).toBe("photos");
    expect(props.sensors).toHaveLength(2);
    expect(React.isValidElement(PhotoSortProvider({ onMove, children: null }))).toBe(true);
  });

  it("swaps in the product-copy announcements and drops the page-wide cursor", () => {
    const other = { name: "other" };
    expect(providerProps().plugins([accessibility, cursor, other])).toEqual([configured, other]);
  });

  it("reports a real move and the dragging state", () => {
    const props = providerProps();
    props.onDragStart({}, manager(new FakePointerEvent()));
    props.onDragEnd(dragEnd(2, 0));

    expect(onDraggingChange.mock.calls).toEqual([[true], [false]]);
    expect(onMove).toHaveBeenCalledExactlyOnceWith(2, 0);
  });

  it("ignores a cancelled drag, a drop in place and a non-sortable source", () => {
    const props = providerProps();
    props.onDragEnd(dragEnd(2, 0, true));
    props.onDragEnd(dragEnd(1, 1));
    props.onDragEnd({ canceled: false, operation: { source: {} } });

    expect(onMove).not.toHaveBeenCalled();
  });

  it("works without a dragging listener", () => {
    const props = providerProps(false);
    expect(() => props.onDragStart({}, manager(new FakePointerEvent()))).not.toThrow();
    props.onDragEnd(dragEnd(0, 1));
    expect(onMove).toHaveBeenCalledExactlyOnceWith(0, 1);
  });

  it("drops a keyboard move where it is on the next click anywhere", () => {
    const props = providerProps();
    const keyboard = manager(new FakeKeyboardEvent());
    props.onDragStart({}, keyboard);

    expect(fakeDocument.addEventListener).toHaveBeenCalledWith("pointerdown", expect.any(Function), {
      capture: true,
      once: true,
    });
    listeners.get("pointerdown")?.();
    expect(keyboard.actions.stop).toHaveBeenCalledExactlyOnceWith();
  });

  it("stops listening for that click once the keyboard move ends", () => {
    const props = providerProps();
    props.onDragStart({}, manager(new FakeKeyboardEvent()));
    props.onDragEnd(dragEnd(0, 1));

    expect(fakeDocument.removeEventListener).toHaveBeenCalledWith("pointerdown", expect.any(Function), {
      capture: true,
    });
    expect(listeners.has("pointerdown")).toBe(false);
  });

  it("leaves a pointer drag to the pointer", () => {
    const props = providerProps();
    props.onDragStart({}, manager(new FakePointerEvent()));
    expect(fakeDocument.addEventListener).not.toHaveBeenCalled();
  });

  it("drops a move still in progress when the list unmounts or its route is hidden", () => {
    const props = providerProps();
    const cleanup = effects[0]();
    const active = manager(new FakeKeyboardEvent());
    props.onDragStart({}, active);

    (cleanup as () => void)();
    expect(active.actions.stop).toHaveBeenCalledExactlyOnceWith();
  });

  it("does nothing on unmount before any drag", () => {
    providerProps();
    const cleanup = effects[0]();
    expect(() => (cleanup as () => void)()).not.toThrow();
  });
});
