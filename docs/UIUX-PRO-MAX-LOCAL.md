# UI/UX Pro Max local workflow

AgenticWeb uses UI/UX Pro Max as a local design-intelligence layer. It is not an application runtime dependency and the website does not need UI/UX Pro Max credits to run.

## Termux / Ubuntu

From the repository root:

```bash
bash scripts/install-uiux-pro-max.sh
```

The script uses the current `ui-ux-pro-max-cli` package and installs the Claude Code skill into the project. The upstream project documents `npx ui-ux-pro-max-cli init --ai claude` as the current installation path. citeturn0search0

## What is local

- `.claude/skills/ui-ux-pro-max/` — Claude Code skill
- `design-system/agenticuantico/MASTER.md` — persisted visual source of truth
- `CLAUDE.md` — implementation rules for AgenticWeb

The generated design system can be refreshed with the skill's Python search script. The upstream skill states that its search scripts use Python 3.x standard-library tooling and do not require additional Python packages. citeturn0search0

## Runtime

The production website does not call UI/UX Pro Max. It only ships the resulting HTML/CSS/JS. This keeps the runtime independent of the design skill.

## 3D direction

Neural OS v3 adds a progressive Three.js neural-core renderer. Three.js supports ES modules and WebGLRenderer; the implementation caps pixel ratio and falls back to the existing avatar canvas when the enhanced renderer cannot initialize. citeturn1search1turn1search6

## Claude workflow

```bash
cd ~/proyectos/AgenticWeb
claude
```

Claude should:

1. read `CLAUDE.md`;
2. inspect the existing application before changing behavior;
3. use the local UI/UX Pro Max skill for visual decisions;
4. preserve chat, authentication, history, uploads, voice, image generation, agents and Cloudflare APIs;
5. run visual checks at mobile and desktop widths;
6. avoid fake functionality.
