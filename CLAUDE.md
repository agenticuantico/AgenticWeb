# AgentiCuantico — Claude Code Master Instructions

## Mission

You are the senior UI/UX, creative technology and frontend implementation agent for AgentiCuantico. Build the next production version of AgenticWeb as an immersive 3D neural interface, not as a generic SaaS dashboard and not as a visual mockup.

The public product is AgenticWeb at https://agenticuantico.dev.ar/. The backend/AI brain is the separate AgentiCuantico project. Preserve the existing API contracts and progressively improve the frontend.

## Mandatory workflow

1. Inspect the repository before changing code.
2. Read this file, `design-system/agenticuantico/MASTER.md`, existing README/docs, `package.json`, `public/index.html`, `public/styles.css`, `public/brain-3d.js`, `public/avatar-3d.js`, `public/avatar-webgpu.js`, `public/premium-runtime.js`, `worker.js`, and existing experience/immersive files.
3. If UI UX Pro Max is installed, use it for UI/UX decisions and run its design-system search before implementation. Do not replace its output with arbitrary generic AI-dashboard styling.
4. Preserve working functionality. Do not delete existing chat, authentication, history, uploads, voice, image-generation, agent, Cloudflare or API behavior merely to simplify the UI.
5. Prefer incremental refactoring and clear ownership of visual systems over creating more overlapping scripts.
6. Before large changes, create a feature branch. Keep changes reviewable.
7. Run syntax/build/static checks after implementation and fix regressions.
8. Never fake functionality. A visual control must either work or be clearly disabled/coming-soon.
9. Respect `prefers-reduced-motion`, keyboard navigation, focus visibility, touch targets and responsive behavior.

## Product vision

Create the feeling that the user has entered the operating space of an artificial neural/quantum-inspired intelligence.

The center of the experience is a living 3D brain/neural core. It should have depth, parallax, volumetric-looking light, neural pathways, particles/spectra, animated energy flow and state changes driven by the actual application state.

The aesthetic target is premium spatial computing / cinematic scientific interface:
- deep near-black environment
- restrained cyan, electric blue, violet and white light accents
- glass and holographic surfaces used selectively
- strong hierarchy and negative space
- no generic purple-gradient SaaS template
- no flat card wall as the primary experience
- no excessive glow that destroys legibility
- no emoji used as interface icons
- use SVG/Lucide-style icons where appropriate

## 3D brain requirements

Use Three.js/WebGL where it materially improves the experience.

Build or evolve a real 3D neural/brain representation:
- anatomical or strongly brain-like silhouette when a suitable local asset exists
- procedural fallback if no asset exists
- neural nodes and connections
- depth/parallax
- orbital structures and subtle spectral fields
- animated signal propagation
- idle, listening, thinking, responding, speaking, error and offline states
- state changes must be connected to real chat/request/voice state
- pointer/touch interaction must be smooth and bounded
- mobile fallback must remain usable
- cap pixel ratio and animation workload on constrained devices
- avoid permanent high-frequency animation when the page is backgrounded

Do not claim quantum computing is actually being performed. Use “quantum-inspired”, “quantum-inspired neural visualization”, or equivalent language unless a real quantum backend exists.

## Conversational interface

The chat remains the functional heart:
- streaming responses
- Markdown/code rendering
- copy
- cancel generation
- attachments
- image generation
- microphone/voice controls
- conversation history
- new conversation
- responsive composer
- real loading/error states
- keyboard and screen-reader accessibility

The chat UI should visually float around or integrate with the neural core rather than looking like a conventional dashboard.

## Agents

Keep the existing agent workspace and make it visually coherent with the neural operating space:
- AgentiQ/general
- Programador
- Diseñador 3D
- Investigador
- custom agents/teams where already supported

Agent selection must affect actual request metadata or backend behavior when supported. Do not create fake autonomous-agent claims.

## Architecture

Prefer:
- existing vanilla HTML/CSS/JS architecture unless migration is demonstrably beneficial
- Three.js/WebGL for the 3D layer
- CSS for layout, typography and accessible UI
- modular JS with explicit ownership
- Cloudflare Worker APIs already present
- progressive enhancement
- graceful fallbacks

Do not introduce React/Next.js solely because a generic tutorial uses it.

## Performance budget

Target:
- fast first meaningful render
- no blocking 3D initialization
- lazy-load heavy 3D assets
- use requestAnimationFrame carefully
- pause/reduce rendering when hidden
- avoid unnecessary DOM observers and duplicate animation loops
- mobile-friendly GPU workload
- preserve chat responsiveness while 3D is active

## Visual QA

Test at minimum:
- 375px mobile
- 768px tablet
- 1024px laptop
- 1440px desktop

Check:
- no horizontal overflow
- no clipped text
- no overlapping controls
- visible focus
- touch targets
- reduced motion
- chat remains readable over the 3D scene
- loading/error/cancel states are visually clear

## Delivery

When the implementation is complete:
1. summarize architecture changes
2. list files changed
3. report checks/tests performed
4. identify anything that still requires credentials, an external asset, a model provider, or a manual Cloudflare setup
5. do not describe a future placeholder as implemented.

The final result should feel like AgentiCuantico has its own visual identity: an immersive neural operating environment with a real conversational AI at the center.
