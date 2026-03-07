---
name: plankton-code-quality
description: "Write-time code quality enforcement using Plankton — auto-formatting, linting, and AI-powered fixes on every file edit via hooks."
origin: community
---

# Plankton Code Quality Skill

Integration reference for Plankton (credit: @alxfazio), a write-time code quality enforcement system for OpenCode. Plankton runs formatters and linters on every file edit via `tool.execute.after` hooks, then spawns OpenCode subprocesses to fix violations the agent didn't catch.

## When to Use

- You want automatic formatting and linting on every file edit (not just at commit time)
- You need defense against agents modifying linter configs to pass instead of fixing code
- You want tiered model routing for fixes (gpt-5.3-codex-spark for simple style, gpt-5.4 medium for logic, gpt-5.4 xhigh for types)
- You work with multiple languages (Python, TypeScript, Shell, YAML, JSON, TOML, Markdown, Dockerfile)

## How It Works

### Three-Phase Architecture

Every time OpenCode edits or writes a file, Plankton's `multi_linter.sh` `tool.execute.after` hook runs:

```
Phase 1: Auto-Format (Silent)
├─ Runs formatters (ruff format, biome, shfmt, taplo, markdownlint)
├─ Fixes 40-50% of issues silently
└─ No output to main agent

Phase 2: Collect Violations (JSON)
├─ Runs linters and collects unfixable violations
├─ Returns structured JSON: {line, column, code, message, linter}
└─ Still no output to main agent

Phase 3: Delegate + Verify
├─ Spawns opencode run subprocess with violations JSON
├─ Routes to model tier based on violation complexity:
│   ├─ gpt-5.3-codex-spark: formatting, imports, style (E/W/F codes) — 120s timeout
│   ├─ gpt-5.4 (medium): complexity, refactoring (C901, PLR codes) — 300s timeout
│   └─ gpt-5.4 (xhigh): type system, deep reasoning (unresolved-attribute) — 600s timeout
├─ Re-runs Phase 1+2 to verify fixes
└─ Exit 0 if clean, Exit 2 if violations remain (reported to main agent)
```

### What the Main Agent Sees

| Scenario | Agent sees | Hook exit |
|----------|-----------|-----------|
| No violations | Nothing | 0 |
| All fixed by subprocess | Nothing | 0 |
| Violations remain after subprocess | `[hook] N violation(s) remain` | 2 |
| Advisory (duplicates, old tooling) | `[hook:advisory] ...` | 0 |

The main agent only sees issues the subprocess couldn't fix. Most quality problems are resolved transparently.

### Config Protection (Defense Against Rule-Gaming)

LLMs will modify `.ruff.toml` or `biome.json` to disable rules rather than fix code. Plankton blocks this with three layers:

1. **`tool.execute.before` hook** — `protect_linter_configs.sh` blocks edits to all linter configs before they happen
2. **Session end hook** — `stop_config_guardian.sh` detects config changes via `git diff` at session end
3. **Protected files list** — `.ruff.toml`, `biome.json`, `.shellcheckrc`, `.yamllint`, `.hadolint.yaml`, and more

### Package Manager Enforcement

A `tool.execute.before` hook on Bash blocks legacy package managers:
- `pip`, `pip3`, `poetry`, `pipenv` → Blocked (use `uv`)
- `npm`, `yarn`, `pnpm` → Blocked (use `bun`)
- Allowed exceptions: `npm audit`, `npm view`, `npm publish`

## Setup

### Quick Start

```bash
# Clone Plankton into your project (or a shared location)
# Note: Plankton is by @alxfazio
git clone https://github.com/alexfazio/plankton.git
cd plankton

# Install core dependencies
brew install jaq ruff uv

# Install Python linters
uv sync --all-extras

# Start OpenCode — hooks activate automatically
opencode
```

No install command, no plugin config. The hooks in the plugin file are picked up automatically when you run OpenCode in the Plankton directory.

### Per-Project Integration

To use Plankton hooks in your own project:

1. Copy `.claude/hooks/` directory to your project
2. Register the hooks in your OpenCode plugin file
3. Copy linter config files (`.ruff.toml`, `biome.json`, etc.)
4. Install the linters for your languages

### Language-Specific Dependencies

| Language | Required | Optional |
|----------|----------|----------|
| Python | `ruff`, `uv` | `ty` (types), `vulture` (dead code), `bandit` (security) |
| TypeScript/JS | `biome` | `oxlint`, `semgrep`, `knip` (dead exports) |
| Shell | `shellcheck`, `shfmt` | — |
| YAML | `yamllint` | — |
| Markdown | `markdownlint-cli2` | — |
| Dockerfile | `hadolint` (>= 2.12.0) | — |
| TOML | `taplo` | — |
| JSON | `jaq` | — |

## Pairing with ECC

### Complementary, Not Overlapping

| Concern | ECC | Plankton |
|---------|-----|----------|
| Code quality enforcement | `tool.execute.after` hooks (Prettier, tsc) | `tool.execute.after` hooks (20+ linters + subprocess fixes) |
| Security scanning | AgentShield, security-reviewer agent | Bandit (Python), Semgrep (TypeScript) |
| Config protection | — | `tool.execute.before` blocks + session end detection |
| Package manager | Detection + setup | Enforcement (blocks legacy PMs) |
| CI integration | — | Pre-commit hooks for git |
| Model routing | Manual (`/model gpt-5.4 --variant xhigh`) | Automatic (violation complexity → tier) |

### Recommended Combination

1. Install supa-opencode as your plugin (agents, skills, commands)
2. Add Plankton hooks for write-time quality enforcement
3. Use AgentShield for security audits
4. Use ECC's verification-loop as a final gate before PRs

### Avoiding Hook Conflicts

If running both ECC and Plankton hooks:
- supa-opencode's Prettier hook and Plankton's biome formatter may conflict on JS/TS files
- Resolution: disable supa-opencode's Prettier `tool.execute.after` hook when using Plankton (Plankton's biome is more comprehensive)
- Both can coexist on different file types (ECC handles what Plankton doesn't cover)

## Configuration Reference

Plankton's `.claude/hooks/config.json` controls all behavior:

```json
{
  "languages": {
    "python": true,
    "shell": true,
    "yaml": true,
    "json": true,
    "toml": true,
    "dockerfile": true,
    "markdown": true,
    "typescript": {
      "enabled": true,
      "js_runtime": "auto",
      "biome_nursery": "warn",
      "semgrep": true
    }
  },
  "phases": {
    "auto_format": true,
    "subprocess_delegation": true
  },
  "subprocess": {
    "tiers": {
      "codex-spark": { "timeout": 120, "max_turns": 10 },
      "medium":      { "timeout": 300, "max_turns": 10 },
      "xhigh":       { "timeout": 600, "max_turns": 15 }
    },
    "volume_threshold": 5
  }
}
```

**Key settings:**
- Disable languages you don't use to speed up hooks
- `volume_threshold` — violations > this count auto-escalate to a higher model tier
- `subprocess_delegation: false` — skip Phase 3 entirely (just report violations)

## Environment Overrides

| Variable | Purpose |
|----------|---------|
| `HOOK_SKIP_SUBPROCESS=1` | Skip Phase 3, report violations directly |
| `HOOK_SUBPROCESS_TIMEOUT=N` | Override tier timeout |
| `HOOK_DEBUG_MODEL=1` | Log model selection decisions |
| `HOOK_SKIP_PM=1` | Bypass package manager enforcement |

## References

- Plankton (credit: @alxfazio)
- Plankton REFERENCE.md — Full architecture documentation (credit: @alxfazio)
- Plankton SETUP.md — Detailed installation guide (credit: @alxfazio)

## ECC v1.8 Additions

### Copyable Hook Profile

Set strict quality behavior:

```bash
export ECC_HOOK_PROFILE=strict
export ECC_QUALITY_GATE_FIX=true
export ECC_QUALITY_GATE_STRICT=true
```

### Language Gate Table

- TypeScript/JavaScript: Biome preferred, Prettier fallback
- Python: Ruff format/check
- Go: gofmt

### Config Tamper Guard

During quality enforcement, flag changes to config files in same iteration:

- `biome.json`, `.eslintrc*`, `prettier.config*`, `tsconfig.json`, `pyproject.toml`

If config is changed to suppress violations, require explicit review before merge.

### CI Integration Pattern

Use the same commands in CI as local hooks:

1. run formatter checks
2. run lint/type checks
3. fail fast on strict mode
4. publish remediation summary

### Health Metrics

Track:
- edits flagged by gates
- average remediation time
- repeat violations by category
- merge blocks due to gate failures
