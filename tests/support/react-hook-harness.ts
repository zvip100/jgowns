import type { ReactElement, ReactNode } from "react";

type ReactModule = typeof import("react");
type Effect = { run: () => void | (() => void); deps?: unknown[] };

/** Hook state by call order, like React's own, so a test can render, act and render again. */
export const harness = {
  states: [] as unknown[],
  stateIndex: 0,
  refs: [] as { current: unknown }[],
  refIndex: 0,
  effects: [] as Effect[],
};

export function resetHarness(): void {
  harness.states = [];
  harness.refs = [];
  beginRender();
}

export function beginRender(): void {
  harness.stateIndex = 0;
  harness.refIndex = 0;
  harness.effects = [];
}

/** Runs the effects of the last render in order and returns their cleanups. */
export function runEffects(): (() => void)[] {
  return harness.effects.flatMap((effect) => {
    const cleanup = effect.run();
    return typeof cleanup === "function" ? [cleanup] : [];
  });
}

/** The `react` module with stateful hooks that work outside a renderer. */
export function mockReact(actual: ReactModule): ReactModule {
  const setter = (index: number) => (next: unknown) => {
    harness.states[index] =
      typeof next === "function" ? (next as (current: unknown) => unknown)(harness.states[index]) : next;
  };
  return {
    ...actual,
    useState: ((initial: unknown) => {
      const index = harness.stateIndex++;
      if (!(index in harness.states)) {
        harness.states[index] = typeof initial === "function" ? (initial as () => unknown)() : initial;
      }
      return [harness.states[index], setter(index)];
    }) as ReactModule["useState"],
    useReducer: ((reducer: (state: unknown, action: unknown) => unknown, arg: unknown, init?: (arg: unknown) => unknown) => {
      const index = harness.stateIndex++;
      if (!(index in harness.states)) harness.states[index] = init ? init(arg) : arg;
      return [
        harness.states[index],
        (action: unknown) => {
          harness.states[index] = reducer(harness.states[index], action);
        },
      ];
    }) as ReactModule["useReducer"],
    useRef: ((initial: unknown) => {
      const index = harness.refIndex++;
      if (!(index in harness.refs)) harness.refs[index] = { current: initial };
      return harness.refs[index];
    }) as ReactModule["useRef"],
    useEffect: ((run: Effect["run"], deps?: unknown[]) => {
      harness.effects.push({ run, deps });
    }) as ReactModule["useEffect"],
    useMemo: ((factory: () => unknown) => factory()) as ReactModule["useMemo"],
    useCallback: ((callback: unknown) => callback) as ReactModule["useCallback"],
  };
}

type Props = Record<string, unknown>;

/** Expands function components into host elements so handlers and props can be reached. */
export function expand(react: ReactModule, node: ReactNode): ReactNode {
  if (Array.isArray(node)) return node.map((child) => expand(react, child));
  if (!react.isValidElement(node)) return node;
  const element = node as ReactElement<Props>;
  if (typeof element.type === "function") {
    return expand(react, (element.type as (props: Props) => ReactNode)(element.props));
  }
  if (typeof element.type === "string" || (element.type as unknown) === react.Fragment) {
    return react.cloneElement(element, undefined, expand(react, element.props.children as ReactNode));
  }
  return element;
}

export function findAll(
  react: ReactModule,
  node: ReactNode,
  match: (props: Props, type: unknown) => boolean,
): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap((child) => findAll(react, child, match));
  if (!react.isValidElement(node)) return [];
  const element = node as ReactElement<Props>;
  const own = match(element.props, element.type) ? [element] : [];
  return [...own, ...findAll(react, element.props.children as ReactNode, match)];
}

/** All text in a tree, for content assertions. */
export function textOf(react: ReactModule, node: ReactNode): string {
  if (Array.isArray(node)) return node.map((child) => textOf(react, child)).join("");
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!react.isValidElement(node)) return "";
  return textOf(react, (node as ReactElement<Props>).props.children as ReactNode);
}
