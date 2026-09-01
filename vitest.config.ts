import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Date formatting assertions are calendar-day sensitive; pin the runner.
    env: { TZ: "UTC" },
    // Externalized packages bypass resolve.alias, so the stub below only takes
    // effect once vite processes this one.
    server: { deps: { inline: ["server-only"] } },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // The runner is not a React Server Components graph, so this marker
      // package's default export throws on import. Next resolves its
      // "react-server" condition to the same empty module in a real build.
      "server-only": path.resolve(
        __dirname,
        "./node_modules/server-only/empty.js",
      ),
    },
  },
});
