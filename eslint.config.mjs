import { config } from '@n8n/node-cli/eslint';

// The n8n config includes `@n8n/community-nodes/no-restricted-imports`, which
// bans runtime dependencies because n8n Cloud installs community nodes without
// their dependency tree. That check is about the *published* package, and
// `files: ["dist"]` in package.json means only compiled `nodes/` and
// `credentials/` output ever ships. The test suite and its config are
// development-only, so they are excluded here — otherwise importing `vitest`
// would fail cloud-compatibility linting for code that is never published.
export default [
	...(Array.isArray(config) ? config : [config]),
	{
		ignores: ['test/**', 'vitest.config.ts'],
	},
];
