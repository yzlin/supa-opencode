/**
 * supa-opencode — OpenCode plugin
 *
 * A full-featured OpenCode plugin providing:
 * - 13 specialized agents (planner, architect, code-reviewer, tdd-guide, etc.)
 * - 31 commands (/plan, /tdd, /code-review, /security, /e2e, etc.)
 * - Plugin hooks (auto-format, TypeScript check, console.log warning, env injection, etc.)
 * - 65 bundled skills (coding-standards, tdd-workflow, security-review, frontend-patterns, etc.)
 *
 * Usage (local directory):
 * ```json
 * { "plugin": ["/path/to/supa-opencode"] }
 * ```
 *
 * Usage (npm package):
 * ```json
 * { "plugin": ["supa-opencode"] }
 * ```
 *
 * @packageDocumentation
 */

export { ECCHooksPlugin, default } from "./plugins/index.js"
export * from "./plugins/index.js"

export const VERSION = "0.1.0"

export const metadata = {
  name: "supa-opencode",
  version: VERSION,
  description: "Everything Claude Code plugin for OpenCode",
  features: {
    agents: 13,
    commands: 31,
    skills: 65,
    hookEvents: [
      "file.edited",
      "tool.execute.before",
      "tool.execute.after",
      "session.created",
      "session.idle",
      "session.deleted",
      "file.watcher.updated",
      "permission.ask",
      "todo.updated",
      "shell.env",
      "experimental.session.compacting",
    ],
  },
}
