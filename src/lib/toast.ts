"use client";

import { toast as sonnerToast } from "sonner";

import type { ReactNode } from "react";
import type { Action } from "sonner";

/** Errors linger longer than neutral toasts */
const ERROR_DURATION_MS = 6000;

/** Narrowed subset of Sonner's per-toast options exposed to call sites. `action`
 * is typed for future use (e.g. an "Undo" button) but unused in v1. Passing an
 * `id` that matches a live toast updates it in place instead of stacking a new
 * one (used to replace an optimistic success with a failure notice). */
export type ToastOptions = {
  id?: string | number;
  description?: ReactNode;
  duration?: number;
  action?: Action;
};

export type ToastPromiseMessages<T> = {
  loading: ReactNode;
  success: ReactNode | ((data: T) => ReactNode);
  error: ReactNode | ((error: unknown) => ReactNode);
};

function success(message: ReactNode, options?: ToastOptions): string | number {
  return sonnerToast.success(message, options);
}

function error(message: ReactNode, options?: ToastOptions): string | number {
  return sonnerToast.error(message, { duration: ERROR_DURATION_MS, ...options });
}

function info(message: ReactNode, options?: ToastOptions): string | number {
  return sonnerToast.info(message, options);
}

function warning(message: ReactNode, options?: ToastOptions): string | number {
  return sonnerToast.warning(message, options);
}

function promise<T>(
  input: Promise<T>,
  messages: ToastPromiseMessages<T>,
): ReturnType<typeof sonnerToast.promise> {
  return sonnerToast.promise(input, messages);
}

export const toast = { success, error, info, warning, promise };
