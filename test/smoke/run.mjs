#!/usr/bin/env node
/**
 * Smoke-test the Roam n8n node the way a user would: import real workflow
 * JSON into n8n, wire a roamApi credential pointed at localhost, and execute.
 *
 * Required:
 *   ROAM_API_KEY          API key for the local Roam appserver
 *
 * Optional:
 *   ROAM_BASE_URL         default http://localhost:5587
 *   N8N_URL               default http://localhost:5678 (use an already-running `npm run dev`)
 *   N8N_EMAIL / N8N_PASSWORD   existing n8n owner (needed if n8n is already set up)
 *   SMOKE_START_N8N=1     spawn a throwaway n8n if N8N_URL is down
 *   SMOKE_GROUP_ID        skip /v1/group.list and send to this group
 *   SMOKE_SKIP_V1=1       only run typeVersion 2 cases
 */

import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');

const ROAM_BASE_URL = (process.env.ROAM_BASE_URL ?? 'http://localhost:5587').replace(/\/$/, '');
const ROAM_API_KEY = process.env.ROAM_API_KEY ?? '';
const N8N_URL = (process.env.N8N_URL ?? 'http://localhost:5678').replace(/\/$/, '');
const N8N_EMAIL = process.env.N8N_EMAIL ?? 'smoke@example.com';
const N8N_PASSWORD = process.env.N8N_PASSWORD ?? 'SmokeTest1!';
const START_N8N = process.env.SMOKE_START_N8N === '1';
const SKIP_V1 = process.env.SMOKE_SKIP_V1 === '1';
const WAIT_MEETING = process.env.SMOKE_WAIT_MEETING_ENDED === '1';
const KEEP_TRIGGER = process.env.SMOKE_KEEP_TRIGGER === '1';

const failures = [];
let n8nProc;
let n8nCookie = '';
let n8nBrowserId = 'n8n-roam-smoke';

function log(msg) {
	console.log(msg);
}

function fail(name, detail) {
	failures.push({ name, detail });
	console.error(`FAIL  ${name}\n      ${detail}`);
}

function pass(name, detail = '') {
	console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function roamRequest(method, path, body) {
	const url = `${ROAM_BASE_URL}${path}`;
	const res = await fetch(url, {
		method,
		headers: {
			Authorization: `Bearer ${ROAM_API_KEY}`,
			Accept: 'application/json',
			'Content-Type': 'application/json',
			'Roam-Version': '2026-08-25',
		},
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	const text = await res.text();
	let json;
	try {
		json = text ? JSON.parse(text) : {};
	} catch {
		json = { raw: text };
	}
	return { res, json, text };
}

async function waitFor(fn, { timeoutMs = 120_000, intervalMs = 500, label = 'service' } = {}) {
	const start = Date.now();
	let lastErr;
	while (Date.now() - start < timeoutMs) {
		try {
			if (await fn()) return;
		} catch (err) {
			lastErr = err;
		}
		await new Promise((r) => setTimeout(r, intervalMs));
	}
	throw new Error(`Timed out waiting for ${label}${lastErr ? `: ${lastErr.message}` : ''}`);
}

async function n8nRequest(method, path, body, { raw = false } = {}) {
	const headers = {
		Accept: 'application/json',
		'Content-Type': 'application/json',
		'browser-id': n8nBrowserId,
	};
	if (n8nCookie) headers.cookie = n8nCookie;
	if (process.env.N8N_API_KEY) headers['X-N8N-API-KEY'] = process.env.N8N_API_KEY;

	const res = await fetch(`${N8N_URL}${path}`, {
		method,
		headers,
		body: body === undefined ? undefined : JSON.stringify(body),
		redirect: 'manual',
	});
	const setCookie = res.headers.getSetCookie?.() ?? [];
	if (setCookie.length) {
		n8nCookie = setCookie.map((c) => c.split(';')[0]).join('; ');
	}
	const text = await res.text();
	if (raw) return { res, text };
	let json;
	try {
		json = text ? JSON.parse(text) : {};
	} catch {
		json = { raw: text };
	}
	return { res, json, text };
}

async function preflightRoam() {
	log(`\n== Roam API ${ROAM_BASE_URL}`);
	if (!ROAM_API_KEY) {
		throw new Error('ROAM_API_KEY is required');
	}
	const { res, json, text } = await roamRequest('GET', '/v1/token.info');
	if (!res.ok) {
		throw new Error(`/v1/token.info → ${res.status} ${text}`);
	}
	pass('roam token.info', json.roam?.name ?? json.clientId ?? 'ok');
	return json;
}

async function pickGroup() {
	if (process.env.SMOKE_GROUP_ID) return process.env.SMOKE_GROUP_ID;
	const { res, json, text } = await roamRequest('GET', '/v1/group.list?limit=1');
	if (!res.ok) throw new Error(`/v1/group.list → ${res.status} ${text}`);
	const group = json.groups?.[0];
	if (!group?.id) throw new Error('No groups returned; set SMOKE_GROUP_ID');
	pass('roam group.list', `${group.name} (${group.id})`);
	return group.id;
}

async function listWebhooks() {
	const { res, json, text } = await roamRequest('GET', '/v1/webhook.list');
	if (!res.ok) throw new Error(`/v1/webhook.list → ${res.status} ${text}`);
	return json.webhooks ?? json ?? [];
}

const n8nLogTail = [];

function rememberN8nLog(chunk) {
	const text = chunk.toString();
	for (const line of text.split('\n')) {
		if (!line) continue;
		n8nLogTail.push(line);
		if (n8nLogTail.length > 80) n8nLogTail.shift();
	}
	if (process.env.SMOKE_N8N_LOG === '1') process.stdout.write(text);
	return text;
}

async function n8nUp() {
	try {
		const res = await fetch(`${N8N_URL}/healthz`, { signal: AbortSignal.timeout(3_000) });
		if (!res.ok) return false;
		const text = await res.text();
		// n8n 2.x serves 200 + "n8n is starting up. Please wait" during migrations.
		return !/starting up/i.test(text);
	} catch {
		return false;
	}
}

async function startN8n() {
	const userFolder =
		process.env.SMOKE_N8N_EPHEMERAL === '1'
			? await mkdtemp(join(tmpdir(), 'n8n-roam-smoke-'))
			: join(tmpdir(), 'n8n-roam-smoke-home');
	// Same layout as `n8n-node dev`: $N8N_USER_FOLDER/.n8n/custom/node_modules/<pkg>
	const customModules = join(userFolder, '.n8n', 'custom', 'node_modules');
	await mkdir(customModules, { recursive: true });
	try {
		await symlink(repoRoot, join(customModules, 'n8n-nodes-roam'), 'dir');
	} catch (err) {
		if (err.code !== 'EEXIST') throw err;
	}

	log(`\n== Starting throwaway n8n in ${userFolder}`);
	const env = { ...process.env };
	delete env.N8N_RUNNERS_ENABLED;
	n8nProc = spawn('npx', ['-y', 'n8n@latest'], {
		cwd: userFolder,
		detached: true,
		env: {
			...env,
			N8N_USER_FOLDER: userFolder,
			// Also scan dist directly so CustomDirectoryLoader does not have to
			// walk through node_modules/.
			N8N_CUSTOM_EXTENSIONS: join(repoRoot, 'dist'),
			N8N_COMMUNITY_PACKAGES_ENABLED: 'true',
			N8N_PORT: new URL(N8N_URL).port || '5678',
			...(process.env.WEBHOOK_URL ? { WEBHOOK_URL: process.env.WEBHOOK_URL } : {}),
			N8N_SECURE_COOKIE: 'false',
			N8N_DIAGNOSTICS_ENABLED: 'false',
			N8N_PERSONALIZATION_ENABLED: 'false',
			N8N_VERSION_NOTIFICATIONS_ENABLED: 'false',
			N8N_TEMPLATES_ENABLED: 'false',
			N8N_HIRING_BANNER_ENABLED: 'false',
			N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS: 'false',
			DB_SQLITE_POOL_SIZE: '4',
			N8N_LOG_LEVEL: 'info',
		},
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	let editorReady = false;
	const onChunk = (buf) => {
		const text = rememberN8nLog(buf);
		if (text.includes('Editor is now accessible')) editorReady = true;
	};
	n8nProc.stdout.on('data', onChunk);
	n8nProc.stderr.on('data', onChunk);
	n8nProc.on('exit', (code, signal) => {
		if (!editorReady) {
			console.error(`n8n exited before ready (code=${code} signal=${signal})`);
		}
	});
	// healthz is 200 during migrations; do not hit REST until the editor is up.
	await waitFor(async () => editorReady, { label: 'n8n editor', timeoutMs: 240_000 });
	await waitFor(n8nUp, { label: 'n8n healthz', timeoutMs: 30_000 });
	pass('n8n started', N8N_URL);
}

async function loginN8n() {
	const setup = await n8nRequest('POST', '/rest/owner/setup', {
		email: N8N_EMAIL,
		firstName: 'Smoke',
		lastName: 'Test',
		password: N8N_PASSWORD,
	});
	if (setup.res.ok) {
		pass('n8n owner setup', N8N_EMAIL);
		return;
	}

	const login = await n8nRequest('POST', '/rest/login', {
		emailOrLdapLoginId: N8N_EMAIL,
		email: N8N_EMAIL,
		password: N8N_PASSWORD,
	});
	if (login.res.ok) {
		pass('n8n login', N8N_EMAIL);
		return;
	}

	if (process.env.N8N_API_KEY) {
		const me = await n8nRequest('GET', '/api/v1/workflows?limit=1');
		if (me.res.ok) {
			pass('n8n API key', 'ok');
			return;
		}
	}

	throw new Error(
		`Cannot authenticate to n8n (${login.res.status} ${login.text}). ` +
			`Set N8N_EMAIL / N8N_PASSWORD for your existing instance, or SMOKE_START_N8N=1 for a throwaway n8n.`,
	);
}

async function discoverTypes() {
	const candidates = [
		'/types/nodes.json',
		'/rest/node-types',
		'/rest/nodes',
		'/api/v1/node-types',
	];
	let types = [];
	const statuses = [];
	for (const path of candidates) {
		const { res, json, text } = await n8nRequest('GET', path);
		statuses.push(`${path}:${res.status}:${text.slice(0, 80).replace(/\s+/g, ' ')}`);
		if (!res.ok) continue;
		const extracted = Array.isArray(json)
			? json
			: (json.data ?? json.nodeTypes ?? json.nodes ?? []);
		if (Array.isArray(extracted) && extracted.length) {
			types = extracted;
			break;
		}
		if (json && typeof json === 'object' && !Array.isArray(json)) {
			const values = Object.values(json);
			if (values.length && values.every((v) => v && typeof v === 'object' && 'name' in v)) {
				types = values;
				break;
			}
		}
	}
	const names = types
		.map((t) => t.name ?? t.type ?? t)
		.filter((n) => typeof n === 'string');
	const roamish = types.filter((t) => {
		const blob = `${t.name ?? ''} ${t.displayName ?? ''} ${t.type ?? ''}`;
		return /roam/i.test(blob);
	});
	const roam = names.find((n) => /\.roam$/.test(n) && !/trigger/i.test(n))
		?? roamish.find((t) => /roam$/i.test(t.name ?? '') && !/trigger/i.test(t.name ?? ''))?.name;
	const roamTrigger = names.find((n) => /roamTrigger$/i.test(n) || /roam\.trigger$/i.test(n))
		?? roamish.find((t) => /trigger/i.test(t.name ?? ''))?.name;
	if (!roam) {
		const tail = n8nLogTail.length ? `\n      n8n log tail:\n      ${n8nLogTail.slice(-20).join('\n      ')}` : '';
		throw new Error(
			`Roam node type not loaded in n8n (saw ${roamish.map((t) => t.name).join(', ') || 'none'} of ${names.length} types; ${statuses.join(' | ')}). ` +
				`Run npm run build, then npm run dev, or SMOKE_START_N8N=1.${tail}`,
		);
	}
	pass('n8n loaded Roam node', roam + (roamTrigger ? `, ${roamTrigger}` : ''));
	return { roam, roamTrigger };
}

async function createCredential() {
	const payload = {
		name: 'Roam Local Smoke',
		type: 'roamApi',
		data: {
			apiKey: ROAM_API_KEY,
			baseUrl: ROAM_BASE_URL,
		},
	};

	let { res, json, text } = await n8nRequest('POST', '/rest/credentials', payload);
	if (!res.ok) {
		({ res, json, text } = await n8nRequest('POST', '/api/v1/credentials', payload));
	}
	if (!res.ok) throw new Error(`create credential → ${res.status} ${text}`);
	const id = json.id ?? json.data?.id;
	if (!id) throw new Error(`credential response missing id: ${text}`);
	pass('n8n credential', String(id));
	return String(id);
}

async function loadWorkflow(file, replacements) {
	const raw = await readFile(join(here, 'workflows', file), 'utf8');
	let patched = raw;
	for (const [key, value] of Object.entries(replacements)) {
		patched = patched.split(key).join(value);
	}
	return JSON.parse(patched);
}

async function upsertWorkflow(workflow) {
	workflow.active = false;
	workflow.settings = workflow.settings ?? { executionOrder: 'v1' };
	const create = await n8nRequest('POST', '/rest/workflows', workflow);
	if (create.res.ok) {
		const id = create.json.id ?? create.json.data?.id;
		return { id: String(id), workflow: create.json.data ?? create.json };
	}
	const pub = await n8nRequest('POST', '/api/v1/workflows', workflow);
	if (!pub.res.ok) {
		throw new Error(`create workflow ${workflow.name} → ${create.res.status} ${create.text} / ${pub.res.status} ${pub.text}`);
	}
	return { id: String(pub.json.id), workflow: pub.json };
}

async function fetchWorkflow(id) {
	let { res, json, text } = await n8nRequest('GET', `/rest/workflows/${id}`);
	if (!res.ok) {
		({ res, json, text } = await n8nRequest('GET', `/api/v1/workflows/${id}`));
	}
	if (!res.ok) throw new Error(`GET workflow ${id} → ${res.status} ${text}`);
	return json.data ?? json;
}

async function setActive(id, active, workflow) {
	const verb = active ? 'activate' : 'deactivate';
	const current = workflow ?? (await fetchWorkflow(id));
	const versionId = current.versionId ?? current.activeVersionId ?? current.activeVersion?.versionId;
	const body = active
		? {
				versionId,
				name: current.name ?? 'smoke',
				description: 'n8n-nodes-roam smoke',
			}
		: { expectedChecksum: current.checksum };
	const attempts = active
		? [
				() => n8nRequest('POST', `/rest/workflows/${id}/activate`, body),
				() => n8nRequest('POST', `/rest/workflows/${id}/publish`, body),
				() => n8nRequest('POST', `/api/v1/workflows/${id}/activate`, { versionId }),
				() => n8nRequest('PATCH', `/rest/workflows/${id}`, { active: true }),
			]
		: [
				() => n8nRequest('POST', `/rest/workflows/${id}/deactivate`, body),
				() => n8nRequest('POST', `/rest/workflows/${id}/unpublish`, body),
				() => n8nRequest('POST', `/api/v1/workflows/${id}/deactivate`, { versionId }),
				() => n8nRequest('PATCH', `/rest/workflows/${id}`, { active: false }),
			];
	let last = { res: { status: 0 }, text: '' };
	for (const attempt of attempts) {
		last = await attempt();
		if (last.res.ok) return last.json.data ?? last.json;
	}
	throw new Error(`${verb} ${id} → ${last.res.status} ${last.text}`);
}

async function postWebhook(path, body = {}) {
	const res = await fetch(`${N8N_URL}/webhook/${path}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
	const text = await res.text();
	let json;
	try {
		json = text ? JSON.parse(text) : {};
	} catch {
		json = { raw: text };
	}
	return { res, json, text };
}

async function runWebhookWorkflow({ file, replacements, webhookPath, assert }) {
	const wf = await loadWorkflow(file, replacements);
	const { id, workflow } = await upsertWorkflow(wf);
	await setActive(id, true, workflow);
	try {
		let result;
		await waitFor(
			async () => {
				result = await postWebhook(webhookPath);
				return result.res.status !== 404;
			},
			{ label: `webhook ${webhookPath}`, timeoutMs: 30_000, intervalMs: 500 },
		);
		await assert(result);
	} finally {
		try {
			await setActive(id, false, workflow);
		} catch (err) {
			fail(`deactivate ${file}`, err.message);
		}
	}
}

async function main() {
	log('Roam n8n smoke test');
	log(`repo ${repoRoot}`);

	await preflightRoam();
	const groupId = await pickGroup();
	const stamp = `n8n-smoke ${new Date().toISOString()}`;

	if (!(await n8nUp())) {
		if (!START_N8N) {
			throw new Error(
				`n8n is not reachable at ${N8N_URL}. Start it with npm run dev, or rerun with SMOKE_START_N8N=1.`,
			);
		}
		await startN8n();
	} else {
		pass('n8n reachable', N8N_URL);
	}

	await loginN8n();
	let types;
	let lastTypeErr;
	try {
		await waitFor(
			async () => {
				try {
					types = await discoverTypes();
					return true;
				} catch (err) {
					lastTypeErr = err;
					if (!/Roam node type not loaded/.test(err.message)) throw err;
					return false;
				}
			},
			{ label: 'Roam node types', timeoutMs: 60_000, intervalMs: 2_000 },
		);
	} catch (err) {
		throw lastTypeErr ?? err;
	}
	const credentialId = await createCredential();

	const shared = {
		__GROUP_ID__: groupId,
		__CREDENTIAL_ID__: credentialId,
		__ROAM_TYPE__: types.roam,
		__ROAM_TRIGGER_TYPE__: types.roamTrigger ?? types.roam.replace(/roam$/i, 'roamTrigger'),
	};

	await runWebhookWorkflow({
		file: 'v2-send-message.json',
		replacements: { ...shared, __MESSAGE_TEXT__: `${stamp} v2` },
		webhookPath: 'roam-smoke-v2-send',
		assert: ({ res, json, text }) => {
			if (!res.ok) {
				fail('v2 send message', `${res.status} ${text}`);
				return;
			}
			const row = Array.isArray(json) ? json[0] : json;
			if (!row?.chatId && !row?.ok) {
				fail('v2 send message', `unexpected body ${text}`);
				return;
			}
			pass('v2 send message', row.chatId ? `chatId=${row.chatId}` : 'ok');
		},
	});

	if (!SKIP_V1) {
		await runWebhookWorkflow({
			file: 'v1-send-message.json',
			replacements: { ...shared, __MESSAGE_TEXT__: `${stamp} v1` },
			webhookPath: 'roam-smoke-v1-send',
			assert: ({ res, json, text }) => {
				if (!res.ok) {
					fail('v1 send message', `${res.status} ${text}`);
					return;
				}
				const row = Array.isArray(json) ? json[0] : json;
				if (!row?.chatId && row?.status !== 'ok') {
					fail('v1 send message', `unexpected body ${text}`);
					return;
				}
				pass('v1 send message', row.chatId ? `chatId=${row.chatId}` : 'ok');
			},
		});
	}

	await runWebhookWorkflow({
		file: 'v2-meeting-list.json',
		replacements: shared,
		webhookPath: 'roam-smoke-v2-meetings',
		assert: ({ res, json, text }) => {
			if (!res.ok) {
				fail('v2 meeting list', `${res.status} ${text}`);
				return;
			}
			const rows = Array.isArray(json) ? json : [json];
			pass('v2 meeting list', `${rows.length} item(s)`);
		},
	});

	if (types.roamTrigger) {
		let before;
		try {
			before = await listWebhooks();
		} catch (err) {
			const msg = String(err.message ?? err);
			if (/missing_scope|403/.test(msg) && /webhook:(read|write)/.test(msg)) {
				log(`SKIP  v2 trigger subscribe — ${msg}`);
				log('      This org key has no webhook:read/write; send/list cases still run.');
				before = null;
			} else {
				fail('v2 trigger webhook.list', msg);
				before = null;
			}
		}
		if (before !== null) {
			const beforeIds = new Set((Array.isArray(before) ? before : []).map((w) => String(w.id)));
			const wf = await loadWorkflow('v2-trigger-meeting-ended.json', shared);
			const { id, workflow } = await upsertWorkflow(wf);
			let created = [];
			try {
				await setActive(id, true, workflow);
				const after = await listWebhooks();
				created = (Array.isArray(after) ? after : []).filter(
					(w) =>
						!beforeIds.has(String(w.id)) &&
						w.event === 'meeting.ended' &&
						String(w.url ?? '').includes('webhook'),
				);
				if (created.length === 0) {
					fail('v2 trigger subscribe', `no new meeting.ended webhook after activate; list=${JSON.stringify(after)}`);
				} else {
					pass('v2 trigger subscribe', created[0]?.id ?? `${after.length} subscription(s)`);
					if (WAIT_MEETING && created[0]) {
						log(`\nWaiting for a live meeting.ended at ${created[0].url}`);
						log('Start and end a Magic Minutes meeting now.');
						await waitFor(
							async () => {
								const execs = await n8nRequest(
									'GET',
									`/rest/executions?limit=20&includeData=true`,
								);
								const payload = execs.json.data ?? execs.json;
								const rows = Array.isArray(payload)
									? payload
									: (payload.results ?? payload.data ?? []);
								const list = Array.isArray(rows) ? rows : [];
								const hit = list.find((row) => {
									const wfId = row.workflowId ?? row.workflow?.id;
									return String(wfId) === String(id) && row.status !== 'waiting';
								});
								if (hit) {
									pass(
										'v2 trigger meeting.ended delivery',
										`${hit.status ?? 'ok'} execution ${hit.id ?? ''}`.trim(),
									);
									return true;
								}
								const deliveries = await roamRequest('GET', '/v1/webhook.deliveries?limit=5');
								if (deliveries.res.ok) {
									const failed = deliveries.json.deliveries ?? deliveries.json ?? [];
									if (Array.isArray(failed) && failed.length) {
										log(`      webhook.deliveries: ${JSON.stringify(failed).slice(0, 400)}`);
									}
								}
								return false;
							},
							{ label: 'meeting.ended delivery', timeoutMs: 600_000, intervalMs: 3_000 },
						);
					}
				}
			} catch (err) {
				fail('v2 trigger subscribe', err.message);
			} finally {
				if (KEEP_TRIGGER) {
					log('Leaving trigger subscribed (SMOKE_KEEP_TRIGGER=1)');
				} else {
					try {
						await setActive(id, false, workflow);
						const remaining = await listWebhooks();
						const leftover = created.filter((c) =>
							(Array.isArray(remaining) ? remaining : []).some((w) => String(w.id) === String(c.id)),
						);
						if (leftover.length) {
							fail(
								'v2 trigger unsubscribe',
								`subscription still listed after deactivate: ${leftover.map((w) => w.id).join(', ')}`,
							);
						} else {
							pass('v2 trigger unsubscribe', 'deactivated');
						}
					} catch (err) {
						fail('v2 trigger unsubscribe', err.message);
					}
				}
			}
		}
	}

	if (failures.length) {
		console.error(`\n${failures.length} failure(s)`);
		process.exitCode = 1;
		return;
	}
	log('\nAll smoke cases passed.');
}

function stopN8n() {
	if (KEEP_TRIGGER) return;
	if (!n8nProc) return;
	try {
		process.kill(-n8nProc.pid, 'SIGKILL');
	} catch {
		try {
			n8nProc.kill('SIGKILL');
		} catch {
			// already gone
		}
	}
}
process.on('exit', stopN8n);
process.on('SIGINT', () => process.exit(130));

main()
	.catch((err) => {
		console.error(err.message || err);
		process.exitCode = 1;
	})
	.finally(() => {
		stopN8n();
		process.exit(process.exitCode ?? 0);
	});
