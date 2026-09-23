# AgentiCuantico UI/UX Pro Max Design System

## Product

AgentiCuantico is an AI/agentic conversational platform. AgenticWeb is the public web interface.

## Experience direction

Immersive Neural Operating Space / Quantum-inspired Neural Interface.

The interface should feel spatial, cinematic and alive while keeping the conversation immediately usable.

## Visual language

- Background: near-black void with subtle depth layers.
- Primary light: cyan/electric blue.
- Secondary light: restrained violet.
- Neutral UI: translucent charcoal/black glass.
- Text: high-contrast white and cool gray.
- Accent states: use color sparingly and never as the only state indicator.
- Avoid generic AI purple/pink gradients as the dominant visual treatment.
- Avoid excessive glassmorphism, excessive blur and decorative noise.

## Typography

Use a modern grotesk/sans-serif system with excellent Latin/Spanish support. Prioritize readability and stable wrapping over novelty. Headings can be expressive but must remain responsive.

## Layout

The neural core is the visual anchor. Chat and controls form a floating spatial console around it.

Primary layers:
1. ambient environment
2. 3D neural core
3. state/HUD layer
4. conversational surface
5. utility controls
6. accessibility/fallback layer

## Motion

Motion should communicate state:
- idle: slow breathing/pulse
- listening: subtle outward field
- thinking: accelerated neural signals
- responding: signal flow toward conversation
- speaking: synchronized spectral modulation
- error: restrained warning state

Respect `prefers-reduced-motion`.

## Components

Use reusable components/styles for:
- neural status pill
- chat surface
- composer
- attachment tray
- voice control
- image-generation control
- agent selector
- conversation history
- system/HUD badges
- modal/dialog
- toast/error
- loading/cancel control

## Accessibility

- WCAG-oriented contrast
- visible focus
- semantic buttons
- accessible labels
- keyboard operation
- no color-only state
- no motion required to understand content
- safe text wrapping
- reduced motion

## Responsive behavior

At narrow widths, simplify the scene and move the conversation surface into a readable bottom-sheet/console layout. The 3D brain remains visible but must never block typing or navigation.

## Implementation rule

This file is the visual source of truth. Page-specific variations must document only intentional deviations.
