import { defineConfig } from "vitest/config";

// Kept apart from vite.config.ts so tests don't boot the Workers runtime.
export default defineConfig({
	resolve: { tsconfigPaths: true },
	test: {
		include: ["src/**/*.test.ts"],
		// `pnpm coverage` writes coverage-final.json for `fallow health`.
		coverage: {
			include: ["src/**/*.{ts,tsx}"],
			reporter: ["text-summary", "json"],
			reportOnFailure: true,
		},
	},
});
