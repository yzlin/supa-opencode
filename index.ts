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

export { default } from "./plugins/index.js"
