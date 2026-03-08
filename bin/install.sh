#!/usr/bin/env bash
# install.sh — Install supa-opencode rules to OpenCode global config.
#
# Usage:
#   ./install.sh [install] <language> [<language> ...]
#
# Examples:
#   bunx supa-opencode install typescript
#   bunx supa-opencode install typescript python golang
#   ./install.sh typescript
#
# What it does:
#   1. Copies rules/common/ and rules/<language>/ to ~/.config/opencode/rules/
#   2. Patches ~/.config/opencode/opencode.json to add the rule file globs
#      to the `instructions` array (preserving all existing entries).
#   3. Symlinks skills/ to ~/.config/opencode/skills/ (preserving existing custom skills).
#
# Requirements:
#   - jq (https://jqlang.github.io/jq/) must be installed for JSON patching.

set -euo pipefail

# Resolve symlinks — needed when invoked as `supa-opencode` via npm/bun bin symlink
SCRIPT_PATH="$0"
while [ -L "$SCRIPT_PATH" ]; do
    link_dir="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"
    SCRIPT_PATH="$(readlink "$SCRIPT_PATH")"
    [[ "$SCRIPT_PATH" != /* ]] && SCRIPT_PATH="$link_dir/$SCRIPT_PATH"
done
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"
RULES_DIR="$SCRIPT_DIR/../rules"
SKILLS_DIR="$SCRIPT_DIR/../skills"
OPENCODE_CONFIG_DIR="${HOME}/.config/opencode"
OPENCODE_CONFIG="${OPENCODE_CONFIG_DIR}/opencode.json"
DEST_RULES_DIR="${OPENCODE_CONFIG_DIR}/rules"
DEST_SKILLS_DIR="${OPENCODE_CONFIG_DIR}/skills"

# --- Strip optional "install" subcommand ---
if [[ "${1:-}" == "install" ]]; then
    shift
fi

# --- Usage ---
if [[ $# -eq 0 ]]; then
    echo "Usage: bunx supa-opencode install <language> [<language> ...]"
    echo ""
    echo "Available languages:"
    for dir in "$RULES_DIR"/*/; do
        name="$(basename "$dir")"
        [[ "$name" == "common" ]] && continue
        echo "  - $name"
    done
    exit 1
fi

# --- Check for jq ---
if ! command -v jq &>/dev/null; then
    echo "Error: jq is required but not installed." >&2
    echo "  Install it: brew install jq  (macOS)  |  apt install jq  (Debian/Ubuntu)" >&2
    echo "" >&2
    echo "After installing jq, re-run this command." >&2
    echo "" >&2
    echo "Manual alternative: add these paths to the 'instructions' array in ${OPENCODE_CONFIG}:" >&2
    echo "  \"${DEST_RULES_DIR}/common/*.md\"" >&2
    for lang in "$@"; do
        echo "  \"${DEST_RULES_DIR}/${lang}/*.md\"" >&2
    done
    exit 1
fi

# --- Helper: symlink a skill directory ---
link_skill() {
    local source="$1"
    local name
    name="$(basename "$source")"
    local target="${DEST_SKILLS_DIR}/${name}"

    if [[ -L "$target" ]]; then
        local current_dest
        current_dest="$(readlink "$target")"
        if [[ "$current_dest" == "$source" ]]; then
            echo "  Skill already linked: ${name}"
        else
            # Stale symlink from a different path (e.g., after npm update) — update it
            rm "$target"
            ln -s "$source" "$target"
            echo "  Updated symlink: ${name} -> ${source}"
        fi
    elif [[ -d "$target" ]]; then
        echo "  Warning: ${target} is a real directory (not a symlink), skipping to preserve custom skill." >&2
    else
        ln -s "$source" "$target"
        echo "  Linked: ${name} -> ${source}"
    fi
}

# --- Helper: patch opencode.json instructions ---
patch_instructions() {
    local glob_path="$1"

    # Create config dir and file if missing
    mkdir -p "$OPENCODE_CONFIG_DIR"
    if [[ ! -f "$OPENCODE_CONFIG" ]]; then
        echo '{}' > "$OPENCODE_CONFIG"
    fi

    # Add glob path if not already present
    local updated
    updated=$(jq --arg p "$glob_path" \
        'if (.instructions // []) | map(. == $p) | any
         then .
         else .instructions = ((.instructions // []) + [$p])
         end' \
        "$OPENCODE_CONFIG")
    echo "$updated" > "$OPENCODE_CONFIG"
}

# --- Install common rules ---
echo "Installing common rules -> ${DEST_RULES_DIR}/common/"
mkdir -p "${DEST_RULES_DIR}/common"
cp -r "${RULES_DIR}/common/." "${DEST_RULES_DIR}/common/"
patch_instructions "${DEST_RULES_DIR}/common/*.md"
echo "  Patched ${OPENCODE_CONFIG}: added common rules to instructions"

# --- Install each requested language ---
for lang in "$@"; do
    # Validate language name to prevent path traversal
    if [[ ! "$lang" =~ ^[a-zA-Z0-9_-]+$ ]]; then
        echo "Error: invalid language name '$lang'. Only alphanumeric, dash, and underscore allowed." >&2
        continue
    fi
    lang_dir="${RULES_DIR}/${lang}"
    if [[ ! -d "$lang_dir" ]]; then
        echo "Warning: rules/${lang}/ does not exist, skipping." >&2
        continue
    fi
    echo "Installing ${lang} rules -> ${DEST_RULES_DIR}/${lang}/"
    mkdir -p "${DEST_RULES_DIR}/${lang}"
    cp -r "${lang_dir}/." "${DEST_RULES_DIR}/${lang}/"
    patch_instructions "${DEST_RULES_DIR}/${lang}/*.md"
    echo "  Patched ${OPENCODE_CONFIG}: added ${lang} rules to instructions"
done

# --- Install skills (language-agnostic, always run) ---
echo ""
echo "Installing skills -> ${DEST_SKILLS_DIR}/"
mkdir -p "$DEST_SKILLS_DIR"
skill_count=0
for skill_dir in "$SKILLS_DIR"/*/; do
    [[ -f "${skill_dir}SKILL.md" ]] || continue
    link_skill "$(cd "$skill_dir" && pwd)"
    (( skill_count++ )) || true
done
echo "  ${skill_count} skill(s) processed."

echo ""
echo "Done. Rules installed to ${DEST_RULES_DIR}/"
echo "      Skills linked to ${DEST_SKILLS_DIR}/"
echo "      Instructions registered in ${OPENCODE_CONFIG}"
