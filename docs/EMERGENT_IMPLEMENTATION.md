# Emergent design integration

This repository is the public AgenticWeb layer for https://agenticuantico.dev.ar.

## Implemented from the Emergent specification

- Cinematic dark / electric-neon visual language with 3D spectrum treatment.
- Interactive Three.js/WebGL neural brain hero with procedural fallback and CI-generated PBR GLB.
- Brain controls: pause/resume, reset, zoom, fullscreen and drag interaction.
- Brain capability inspector for Coding, Vision, Research, Voice, Files, Automation and Data.
- ChatGPT-style workspace with conversation history, local memory, file context, voice controls and integration settings.
- Six primary voice/locales from the specification: es-AR, pt-BR, en-US, es-ES, fr-FR and de-DE.
- Female/male voice preference plus browser/neural-TTS fallback.
- GitHub, Cloudflare, Hugging Face and Google integrations in the public UI.
- Claude Code + UI/UX Pro Max + 21st.dev workflow showcase and copyable command.
- Runtime accessibility/test identifiers are assigned to interactive controls with kebab-case data-testid values.
- Public frontend contains no provider secret values.

## Separation

AgenticWeb remains the public UI and Cloudflare edge/runtime. Private credentials, administrative state and sensitive AI/backend logic must stay in the private AgentiCuantico/Core environment or Cloudflare Worker secrets.

The Cloudflare deployment workflow generates public/assets/AgentiCuantico_brain_PBR.glb during deployment from scripts/generate_brain_glb.py; the binary is intentionally not committed to the public repository.

## Deployment

.github/workflows/cloudflare.yml deploys worker.js and public/** to the Cloudflare Worker named agenticweb and binds the custom domain agenticuantico.dev.ar.

Never commit API keys, OAuth secrets, payment credentials, HF tokens or admin keys to this repository.