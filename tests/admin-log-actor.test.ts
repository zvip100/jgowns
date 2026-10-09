import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LogActor } from "@/app/(admin)/admin/logs/LogActor";

const USER_ID = "22222222-2222-4222-8222-222222222222";

describe("LogActor", () => {
  it.each(["seller", "admin"] as const)(
    "links a %s actor to their user page",
    (role) => {
      const html = renderToStaticMarkup(
        React.createElement(LogActor, {
          entry: { actor_id: USER_ID, actor_email: "a@b.com", actor_role: role },
        }),
      );

      expect(html).toContain(`href="/admin/users/${USER_ID}"`);
      expect(html).toContain("a@b.com");
    },
  );

  it("renders a System row as plain text", () => {
    const html = renderToStaticMarkup(
      React.createElement(LogActor, {
        entry: { actor_id: null, actor_email: null, actor_role: "system" },
      }),
    );

    expect(html).not.toContain("<a");
    expect(html).toContain("System");
    expect(html).toContain("italic");
  });

  it("leaves a deleted account unlinked", () => {
    const html = renderToStaticMarkup(
      React.createElement(LogActor, {
        entry: { actor_id: null, actor_email: "gone@b.com", actor_role: "seller" },
      }),
    );

    expect(html).not.toContain("<a");
    expect(html).toContain("gone@b.com");
  });
});
