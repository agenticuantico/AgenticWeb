# AgentiCuantico Neural OS — Design System
Version: 3.0
Target: immersive AI operating space / conversational neural interface
Stack: HTML + CSS + JavaScript + Canvas/WebGL + Cloudflare Workers

## Product model
AgentiCuantico is a conversational operating space, not a dashboard clone. The primary interaction is the AI conversation; agents, tools, projects and account surfaces remain secondary layers.

## Visual direction
- Deep-space editorial interface with restrained glass surfaces.
- Central procedural neural/3D core as the visual anchor.
- Asymmetric composition: conversation lower-left, neural core center, telemetry upper/right.
- Avoid generic purple/pink AI gradients, excessive cards, decorative dashboards and fake agent activity.
- Depth comes from lighting, blur, scale, motion and spatial hierarchy rather than particle noise alone.

## Tokens
- Void: #03050B
- Text: #EEF7FF
- Muted: #8293A8
- Cyan signal: #73E6FF
- Violet signal: #A98CFF
- Mint state: #A7FFE0
- Lines: rgba(170,215,255,.13)
- Strong line: rgba(110,220,255,.34)
- Panel: rgba(8,12,22,.68)
- Strong panel: rgba(10,15,28,.90)

## Interaction rules
- Chat must remain usable without 3D.
- Every generation must be cancellable where the backend supports it.
- Preserve keyboard focus and visible focus states.
- Respect prefers-reduced-motion.
- Mobile: conversation gets priority; decorative HUD elements disappear before core functionality.
- Never claim an agent performed work unless the backend actually performed it.

## 3D rules
- Central core is the single dominant visual object.
- Prefer anatomical/neural depth over a flat orb.
- Keep 3D decorative work GPU-light and frame-rate aware.
- No continuous expensive post-processing on low-power devices.
- Use Canvas/WebGL fallback and existing avatar/brain runtime before introducing a new framework.

## Components
- Neural Header: identity + live state + model name.
- Neural Composer: attach, text, voice, send.
- Conversation Stream: glass messages, readable contrast, max width.
- Neural Core: 3D/Canvas visual anchor.
- Telemetry: small, non-dominant system state.
- Secondary tools: agents, teams, CodQ, projects, skills.

## Responsive checkpoints
375, 560, 768, 900, 1440px.
