import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['test/**/*.test.ts'],
		// Integration tests start the real Quarto CLI. A render takes seconds, and a CI
		// runner is slower than a developer machine, so the default 5 s budget is too tight.
		testTimeout: 120_000,
		hookTimeout: 120_000,
		coverage: {
			provider: 'v8',
			reporter: ['text', 'lcov'],
			include: ['src/**/*.ts'],
			exclude: ['src/index.ts'],
			// The pure core carries the rules that must never regress.
			thresholds: {
				'src/core/**': {
					statements: 100,
					branches: 100,
					functions: 100,
					lines: 100,
				},
			},
		},
	},
});
