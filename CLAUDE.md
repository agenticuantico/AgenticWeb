# AgenticWeb — UI/UX Pro Max workflow
For UI/UX tasks in this repository, use the installed UI/UX Pro Max skill when available.

## Rules
1. Audit the existing DOM, runtime IDs and Cloudflare integration before changing behavior.
2. Preserve working chat/auth/upload/voice IDs and API contracts unless a migration is intentional and documented.
3. Read `design-system/agenti-cuanti-co/MASTER.md` before visual changes.
4. Prefer HTML/CSS/JavaScript and existing Canvas/WebGL infrastructure; do not introduce a framework only for visual polish.
5. The visual target is Neural OS v3: immersive 3D neural core + conversational operating space.
6. Never fake backend agents, model execution, uploads, billing or authentication.
7. Test at 375/560/768/900/1440 widths and with prefers-reduced-motion.
8. Avoid destructive rewrites. Create focused commits and explain migrations.
