# supa-opencode

A full-featured [OpenCode](https://opencode.ai) plugin — extracted from [Everything Claude Code](https://github.com/affaan-m/everything-claude-code).

## What's Included

- **13 agents** — planner, architect, code-reviewer, tdd-guide, security-reviewer, build-error-resolver, e2e-runner, refactor-cleaner, doc-updater, go-reviewer, go-build-resolver, database-reviewer
- **31 commands** — `/plan`, `/tdd`, `/code-review`, `/security`, `/build-fix`, `/e2e`, `/refactor-clean`, `/go-review`, `/go-test`, `/go-build`, and more
- **65 bundled skills** — coding-standards, tdd-workflow, security-review, frontend-patterns, backend-patterns, golang-patterns, swiftui-patterns, docker-patterns, and more
- **Plugin hooks** — auto-format on save, TypeScript check, console.log audit, session notifications, env injection, context compaction, permission auto-approve

## Installation

### Option 1: Local directory (no build step required)

Clone the repo and point OpenCode at it:

```bash
git clone https://github.com/yzlin/supa-opencode ~/dev/yzlin/supa-opencode
```

In your project's `opencode.json`:

```json
{
  "plugin": ["/Users/yourname/dev/yzlin/supa-opencode"]
}
```

### Option 2: npm package

```bash
npm install supa-opencode
```

In your `opencode.json`:

```json
{
  "plugin": ["supa-opencode"]
}
```

### Option 3: Use as a standalone project

Clone and run OpenCode from this directory — the `opencode.json` at the root is pre-configured:

```bash
git clone https://github.com/yzlin/supa-opencode
cd supa-opencode
opencode
```

## Hook Configuration

Hooks can be tuned via environment variables:

| Variable | Default | Options |
|----------|---------|---------|
| `ECC_HOOK_PROFILE` | `standard` | `minimal`, `standard`, `strict` |
| `ECC_DISABLED_HOOKS` | _(none)_ | Comma-separated hook IDs to disable |

**Hook IDs:** `post:edit:format`, `post:edit:console-warn`, `post:edit:typecheck`, `pre:bash:git-push-reminder`, `pre:write:doc-file-warning`, `session:start`, `stop:check-console-log`

Example — disable auto-format and TypeScript check:
```bash
export ECC_DISABLED_HOOKS="post:edit:format,post:edit:typecheck"
```

## Plugin System

The plugin hooks are in `plugins/ecc-hooks.ts` and handle:

| Event | Action |
|-------|--------|
| `file.edited` | Prettier format + console.log warn |
| `tool.execute.after` | TypeScript check after `.ts` edits |
| `tool.execute.before` | Security/doc-file warnings |
| `session.created` | Log profile, check for CLAUDE.md |
| `session.idle` | console.log audit + macOS notification |
| `session.deleted` | Cleanup |
| `shell.env` | Inject `PROJECT_ROOT`, `PACKAGE_MANAGER`, `DETECTED_LANGUAGES` |
| `experimental.session.compacting` | Preserve ECC context across compaction |
| `permission.ask` | Auto-approve reads, formatters, test runs |

## Building

```bash
npm install
npm run build   # outputs to dist/
```
