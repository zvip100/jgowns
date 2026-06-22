import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";

import {
  AuthAltLink,
  AuthEmailField,
  AuthPasswordField,
  AuthPhoneField,
  AuthSubmitButton,
} from "@/app/(auth)/auth-form";

const noop = (): void => {};

describe("AuthSubmitButton", () => {
  it("shows the idle label and is enabled when not pending", () => {
    const html = renderToStaticMarkup(
      React.createElement(AuthSubmitButton, {
        pending: false,
        label: "Sign In",
        pendingLabel: "Signing in…",
      }),
    );

    expect(html).toContain("Sign In");
    expect(html).not.toContain('disabled=""');
  });

  it("shows the pending label and is disabled when pending", () => {
    const html = renderToStaticMarkup(
      React.createElement(AuthSubmitButton, {
        pending: true,
        label: "Sign In",
        pendingLabel: "Signing in…",
      }),
    );

    expect(html).toContain("Signing in…");
    expect(html).toContain('disabled=""');
  });
});

describe("AuthAltLink", () => {
  it("links to the bare path when next is the default", () => {
    const html = renderToStaticMarkup(
      React.createElement(AuthAltLink, {
        prompt: "New here?",
        linkText: "Create an account",
        to: "/register",
        next: "/dashboard",
      }),
    );

    expect(html).toContain("New here?");
    expect(html).toContain("Create an account");
    expect(html).toContain('href="/register"');
  });

  it("preserves a non-default next in the link href", () => {
    const html = renderToStaticMarkup(
      React.createElement(AuthAltLink, {
        prompt: "Already have an account?",
        linkText: "Sign in",
        to: "/login",
        next: "/dashboard/new",
      }),
    );

    expect(html).toContain('href="/login?next=%2Fdashboard%2Fnew"');
  });
});

describe("auth fields", () => {
  it("AuthEmailField renders an email input with email autocomplete", () => {
    const html = renderToStaticMarkup(
      React.createElement(AuthEmailField, { value: "", onChange: noop }),
    ).toLowerCase();

    expect(html).toContain('id="email"');
    expect(html).toContain('type="email"');
    expect(html).toContain('autocomplete="email"');
  });

  it("AuthPasswordField renders a password input with the given autocomplete", () => {
    const html = renderToStaticMarkup(
      React.createElement(AuthPasswordField, {
        value: "",
        onChange: noop,
        autoComplete: "new-password",
      }),
    ).toLowerCase();

    expect(html).toContain('id="password"');
    expect(html).toContain('type="password"');
    expect(html).toContain('autocomplete="new-password"');
  });

  it("AuthPhoneField renders a tel input with tel autocomplete", () => {
    const html = renderToStaticMarkup(
      React.createElement(AuthPhoneField, { value: "", onChange: noop }),
    ).toLowerCase();

    expect(html).toContain('id="phone"');
    expect(html).toContain('type="tel"');
    expect(html).toContain('autocomplete="tel"');
  });
});
