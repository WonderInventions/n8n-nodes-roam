import { defineConfig } from 'vitest/config';

export default defineConfig({
	// n8n-workflow ships sourcemaps that point at sources it does not publish;
	// without this every run buries the results under ~40 Vite warnings.
	logLevel: 'error',
	test: {
		// Tests live outside nodes/ and credentials/ so `n8n-node build` (which
		// compiles exactly those two trees into dist/) never ships them, and
		// `n8n-node lint` — which applies n8n's node-authoring rules — never
		// tries to lint them as node definitions.
		include: ['test/**/*.test.ts'],
		environment: 'node',
	},
});
