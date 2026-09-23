#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> AgenticWeb / UI UX Pro Max local setup"
command -v node >/dev/null || { echo "Node.js 18+ requerido."; exit 1; }
command -v python3 >/dev/null || { echo "Python 3 requerido."; exit 1; }

echo "Node: $(node --version)"
echo "Python: $(python3 --version)"

echo "==> Installing the open-source UI/UX Pro Max CLI locally for this project..."
npx --yes ui-ux-pro-max-cli init --ai claude

echo "==> Generating/updating the AgentiCuantico design-system..."
SKILL=".claude/skills/ui-ux-pro-max"
if [ -f "$SKILL/scripts/search.py" ]; then
  python3 "$SKILL/scripts/search.py" "AI agentic platform immersive 3D neural interface scientific spatial computing" --design-system --persist -p "AgentiCuantico"
fi

echo
echo "Ready. Start Claude Code with:"
echo "  claude"
echo
echo "Then ask Claude to inspect CLAUDE.md and implement the Neural OS v3 without deleting working functionality."
