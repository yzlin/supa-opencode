/**
 * Everything Claude Code (ECC) Plugin Hooks for OpenCode
 *
 * This plugin translates Claude Code hooks to OpenCode's plugin system.
 * OpenCode's plugin system is MORE sophisticated than Claude Code with 20+ events
 * compared to Claude Code's 3 phases (PreToolUse, PostToolUse, Stop).
 *
 * Hook Event Mapping:
 * - PreToolUse → tool.execute.before
 * - PostToolUse → tool.execute.after
 * - Stop → session.idle / session.status
 * - SessionStart → session.created
 * - SessionEnd → session.deleted
 */

import type { Hooks, PluginInput } from "@opencode-ai/plugin";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

// Resolve plugin root directory (one level up from dist/)
const PLUGIN_DIR = join(dirname(fileURLToPath(import.meta.url)), "../..");

function readPluginFile(relPath: string): string {
	try {
		return readFileSync(join(PLUGIN_DIR, relPath), "utf-8");
	} catch {
		return "";
	}
}

function resolveFileRefs(template: string): string {
	return template.replace(/\{file:([^}]+)\}/g, (_, relPath) =>
		readPluginFile(relPath),
	);
}

const ECCHooksPlugin = async ({
	client,
	$,
	directory,
	worktree,
}: PluginInput): Promise<Hooks> => {
	type HookProfile = "minimal" | "standard" | "strict";

	// Track files edited in current session for console.log audit
	const editedFiles = new Set<string>();

	const log = (level: "debug" | "info" | "warn" | "error", message: string) =>
		client.app.log({ body: { service: "ecc", level, message } });

	const normalizeProfile = (value: string | undefined): HookProfile => {
		if (value === "minimal" || value === "strict") return value;
		return "standard";
	};

	const currentProfile = normalizeProfile(process.env.ECC_HOOK_PROFILE);
	const disabledHooks = new Set(
		(process.env.ECC_DISABLED_HOOKS || "")
			.split(",")
			.map((item) => item.trim())
			.filter(Boolean),
	);

	const profileOrder: Record<HookProfile, number> = {
		minimal: 0,
		standard: 1,
		strict: 2,
	};

	const hookEnabled = (
		hookId: string,
		requiredProfile: HookProfile | HookProfile[] = "standard",
	): boolean => {
		if (disabledHooks.has(hookId)) return false;
		const required = Array.isArray(requiredProfile)
			? requiredProfile
			: [requiredProfile];
		return required.some(
			(p) => profileOrder[currentProfile] >= profileOrder[p],
		);
	};

	const OBSERVE_SCRIPT = join(
		PLUGIN_DIR,
		"skills/continuous-learning/hooks/observe.sh",
	);

	const spawnObserver = (phase: "pre" | "post", payload: object): void => {
		if (!hookEnabled("continuous-learning:observe", "minimal")) return;
		try {
			const proc = spawn("bash", [OBSERVE_SCRIPT, phase], {
				stdio: ["pipe", "ignore", "ignore"],
				detached: false,
			});
			proc.stdin.write(JSON.stringify(payload));
			proc.stdin.end();
			proc.unref(); // fire-and-forget, don't block
		} catch {
			// never block tool execution
		}
	};

	return {
		/**
		 * TypeScript Check Hook
		 * Triggers after edit tool on .ts/.tsx files — runs tsc --noEmit
		 */
		"tool.execute.after": async (
			input: {
				tool: string;
				sessionID: string;
				callID: string;
				args: Record<string, unknown>;
			},
			_output,
		) => {
			const filePath = String(
				input.args?.filePath ?? input.args?.file_path ?? "",
			);

			if (
				hookEnabled("post:edit:typecheck", ["standard", "strict"]) &&
				input.tool === "edit" &&
				filePath.match(/\.tsx?$/)
			) {
				editedFiles.add(filePath);
				try {
					await $`npx tsc --noEmit 2>&1`;
					log("info", "[ECC] TypeScript check passed");
				} catch (error: unknown) {
					const err = error as { stdout?: string };
					log("warn", "[ECC] TypeScript errors detected:");
					if (err.stdout) {
						err.stdout
							.split("\n")
							.slice(0, 5)
							.forEach((line) => log("warn", `  ${line}`));
					}
				}
			}

			if (
				hookEnabled("post:edit:format", ["standard", "strict"]) &&
				input.tool === "edit" &&
				filePath.match(/\.(ts|tsx|js|jsx)$/)
			) {
				editedFiles.add(filePath);
				try {
					await $`prettier --write ${filePath} 2>/dev/null`;
					log("info", `[ECC] Formatted: ${filePath}`);
				} catch {
					// Prettier not installed — silently continue
				}
			}

			if (
				hookEnabled("post:bash:pr-created", ["standard", "strict"]) &&
				input.tool === "bash"
			) {
				const cmd = String(input.args?.command ?? "");
				if (cmd.includes("gh pr create")) {
					log("info", "[ECC] PR created - check GitHub Actions status");
				}
			}

		// Continuous learning observation (fire-and-forget)
		spawnObserver("post", {
			tool_name: input.tool,
			tool_output:
				typeof _output === "string" ? _output : JSON.stringify(_output ?? ""),
			session_id: input.sessionID,
			tool_use_id: input.callID,
			cwd: worktree || directory,
		});
		},

		/**
		 * Pre-Tool Security / Reminder Hook
		 */
		"tool.execute.before": async (
			input: { tool: string; sessionID: string; callID: string },
			output: { args: Record<string, unknown> },
		) => {
			const args = output.args ?? {};
			const cmd = String(args.command ?? args.cmd ?? "");
			const filePath = String(args.filePath ?? args.file_path ?? "");

			if (
				hookEnabled("pre:bash:git-push-reminder", "strict") &&
				input.tool === "bash" &&
				cmd.includes("git push")
			) {
				log(
					"info",
					"[ECC] Remember to review changes before pushing: git diff origin/main...HEAD",
				);
			}

			if (
				hookEnabled("pre:write:doc-file-warning", ["standard", "strict"]) &&
				input.tool === "write" &&
				filePath.match(/\.(md|txt)$/i) &&
				!filePath.match(/README|CHANGELOG|LICENSE|CONTRIBUTING/i)
			) {
				log(
					"warn",
					`[ECC] Creating ${filePath} - consider if this documentation is necessary`,
				);
			}

			if (
				hookEnabled("pre:bash:long-running-reminder", "strict") &&
				input.tool === "bash"
			) {
				if (
					cmd.match(/^(npm|pnpm|yarn|bun)\s+(install|build|test|run)/) ||
					cmd.match(/^(cargo|go)\s+(build|test|run)/)
				) {
					log(
						"info",
						"[ECC] Long-running command detected - consider using background execution",
					);
				}
			}

		// Continuous learning observation (fire-and-forget)
		spawnObserver("pre", {
			tool_name: input.tool,
			tool_input: output.args ?? {},
			session_id: input.sessionID,
			tool_use_id: input.callID,
			cwd: worktree || directory,
		});
		},

		/**
		 * Shell Environment Injection
		 * Injects ECC_VERSION, PROJECT_ROOT, PACKAGE_MANAGER, DETECTED_LANGUAGES
		 */
		"shell.env": async (
			_input: { cwd: string; sessionID?: string; callID?: string },
			output: { env: Record<string, string> },
		) => {
			output.env.ECC_VERSION = "1.8.0";
			output.env.ECC_PLUGIN = "true";
			output.env.ECC_HOOK_PROFILE = currentProfile;
			output.env.PROJECT_ROOT = worktree || directory;
			output.env.OPENCODE_PLUGIN_DIR = PLUGIN_DIR;

			const lockfiles: Record<string, string> = {
				"bun.lockb": "bun",
				"pnpm-lock.yaml": "pnpm",
				"yarn.lock": "yarn",
				"package-lock.json": "npm",
			};
			for (const [lockfile, pm] of Object.entries(lockfiles)) {
				try {
					await $`test -f ${worktree}/${lockfile}`;
					output.env.PACKAGE_MANAGER = pm;
					break;
				} catch {
					// not found
				}
			}

			const langDetectors: Record<string, string> = {
				"tsconfig.json": "typescript",
				"go.mod": "go",
				"pyproject.toml": "python",
				"Cargo.toml": "rust",
				"Package.swift": "swift",
			};
			const detected: string[] = [];
			for (const [file, lang] of Object.entries(langDetectors)) {
				try {
					await $`test -f ${worktree}/${file}`;
					detected.push(lang);
				} catch {
					// not found
				}
			}
			if (detected.length > 0) {
				output.env.DETECTED_LANGUAGES = detected.join(",");
				output.env.PRIMARY_LANGUAGE = detected[0];
			}
		},

		/**
		 * Session Compaction Hook
		 * Preserves ECC context across compaction
		 */
		"experimental.session.compacting": async (
			_input: { sessionID: string },
			output: { context: string[]; prompt?: string },
		) => {
			output.context.push(
				"## Active Plugin: supa-opencode",
				"- Hooks: tool.execute.before/after, shell.env, compacting, permission.ask",
				"- Agents: 13 specialized (planner, architect, tdd-guide, code-reviewer, security-reviewer, build-error-resolver, e2e-runner, refactor-cleaner, doc-updater, go-reviewer, go-build-resolver, database-reviewer, python-reviewer)",
				"- Key Principles: TDD (write tests first, 80%+ coverage), immutability (never mutate), security (validate inputs, no hardcoded secrets)",
			);

			if (editedFiles.size > 0) {
				output.context.push("## Recently Edited Files");
				for (const f of editedFiles) {
					output.context.push(`- ${f}`);
				}
			}

			output.prompt =
				"Focus on preserving: 1) Current task status and progress, 2) Key decisions made, 3) Files created/modified, 4) Remaining work items, 5) Any security concerns flagged. Discard: verbose tool outputs, intermediate exploration, redundant file listings.";
		},

		/**
		 * Permission Hook
		 * Auto-approve read-only and formatting operations
		 */
		"permission.ask": async (
			input: {
				id: string;
				type: string;
				sessionID: string;
				messageID: string;
				callID?: string;
				title: string;
				metadata: Record<string, unknown>;
				pattern?: string | string[];
			},
			output: { status: "ask" | "deny" | "allow" },
		) => {
			log("info", `[ECC] Permission requested for: ${input.type}`);

			const metadata = input.metadata ?? {};
			const cmd = String(metadata.command ?? metadata.cmd ?? "");
			const tool = String(metadata.tool ?? input.type ?? "");

			if (["read", "glob", "grep", "search", "list"].includes(tool)) {
				output.status = "allow";
				return;
			}

			if (
				tool === "bash" &&
				/^(npx )?(prettier|biome|black|gofmt|rustfmt|swift-format)/.test(cmd)
			) {
				output.status = "allow";
				return;
			}

			if (
				tool === "bash" &&
				/^(npm test|npx vitest|npx jest|pytest|go test|cargo test)/.test(cmd)
			) {
				output.status = "allow";
				return;
			}
		},

		/**
		 * Config Injection Hook
		 * Injects supa-opencode commands, agents, and instructions into the consuming
		 * project's config so they're available as /commands and sub-agents.
		 */
		config: async (config) => {
			const ocJson = JSON.parse(readPluginFile("opencode.json")) as {
				command?: Record<
					string,
					{
						template: string;
						description?: string;
						agent?: string;
						model?: string;
						subtask?: boolean;
					}
				>;
				agent?: Record<
					string,
					{
						prompt?: string;
						description?: string;
						model?: string;
						mode?: "subagent" | "primary" | "all";
						tools?: Record<string, boolean>;
					}
				>;
				instructions?: string[];
			};

			// Inject commands — consumer config wins on conflicts
			config.command = config.command ?? {};
			for (const [name, def] of Object.entries(ocJson.command ?? {})) {
				if (config.command[name]) continue;
				config.command[name] = {
					...def,
					template: resolveFileRefs(def.template),
				};
			}

			// Inject agents — consumer config wins on conflicts
			config.agent = config.agent ?? {};
			for (const [name, def] of Object.entries(ocJson.agent ?? {})) {
				if (config.agent[name]) continue;
				const prompt = def.prompt ? resolveFileRefs(def.prompt) : undefined;
				config.agent[name] = { ...def, prompt };
			}

			// Inject instructions as absolute paths
			const anyConfig = config as Record<string, unknown>;
			if (!anyConfig.instructions) anyConfig.instructions = [];
			const existing = anyConfig.instructions as string[];
			for (const relPath of ocJson.instructions ?? []) {
				const absPath = join(PLUGIN_DIR, relPath);
				if (!existing.includes(absPath)) existing.push(absPath);
			}
		},
	};
};

export default ECCHooksPlugin;
