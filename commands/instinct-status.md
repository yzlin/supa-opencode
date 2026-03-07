---
description: Show learned instincts (project + global) with confidence
agent: build
---

# Instinct Status Command

Show instinct status from continuous-learning-v2: $ARGUMENTS

## Your Task

Run:

```bash
python3 "${OPENCODE_PLUGIN_DIR}/skills/continuous-learning-v2/scripts/instinct-cli.py" status
```

If `OPENCODE_PLUGIN_DIR` is unavailable (plugin not loaded), find the script:

```bash
python3 ~/.config/opencode/node_modules/supa-opencode/skills/continuous-learning-v2/scripts/instinct-cli.py status
```

## Behavior Notes

- Output includes both project-scoped and global instincts.
- Project instincts override global instincts when IDs conflict.
- Output is grouped by domain with confidence bars.
- This command does not support extra filters in v2.1.
