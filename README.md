# The Illusion of User-Centered Design

A 3D interactive TED-style presentation website for a 60-minute talk exploring the tension between user research and design vision.

## Overview

This is a browser-based presentation deck with:
- **17 full-screen sections** mapping to talk beats and timing
- **Particle-based 3D animations** (Three.js) that morph between shapes as you scroll
- **Interactive hover regions** where graphics respond and highlight corresponding parts
- **Smooth scroll navigation** (Lenis) with snap-to-section behavior
- **Custom cursor** that grows on hover
- **Presenter cues** embedded as marginalia
- **Professional minimal design** inspired by TED talks and contemporary design work

## Tech Stack

- **Three.js** — WebGL rendering, particle system (14,000 particles), custom shaders
- **GSAP** — timeline-based morphing, scroll-triggered reveals
- **Lenis** — smooth scrolling with momentum and soft snapping
- **Vanilla JS** — no framework dependencies

## Running Locally

```bash
python3 -m http.server 4317 --bind 127.0.0.1
```

Then visit: `http://localhost:4317`

## Key Features

### Particle Morphing
Each slide displays a unique particle shape that smoothly morphs from the previous one. Particles use:
- Custom vertex/fragment shaders for rendering and interactivity
- Staggered lerp-based interpolation (smooth easing between shapes)
- Idle "breathing" motion and burst turbulence on transitions
- Per-particle group tagging for hover highlighting

### Interactive Hover Groups
Hover over interactive elements to highlight their corresponding particle regions:
- Timeline products (Walkman, iPhone, Airbnb, Uber, Netflix)
- Bicycle parts (frame, gears, tires, aero, brakes)
- Process stages (observe, interpret, imagine, prototype, validate)
- Spectrum beam (research vs. vision balance)

### Responsive Typography
- Display: up to 7.6rem, scales down smoothly
- Body: minimum 1.1rem for readability across viewport sizes
- Mono metadata: 13px with wider tracking
- All copy reviewed for human tone, no overuse of em-dashes

### Scroll Snap
- Soft snap behavior with velocity detection (>0.3 threshold)
- 200ms debounce to avoid snap jitter
- Keyboard navigation (arrows, Page Up/Down, Home/End)
- Dot navigation in fixed UI

## File Structure

- `index.html` — 17 panels with content, metadata, and hover targets
- `style.css` — typography, layout, animations, responsive design
- `main.js` — Three.js scene, particle engine, scroll logic, shader code
- `.claude/launch.json` — dev server configuration

## Design Notes

### Color Palette
- Background: `#0a0a0b` (deep black)
- Ink: `#f2efe8` (warm ivory)
- Accent: `#ff5b26` (burnt orange)
- Spotify green: `#1ed760`
- Custom shades per slide for morphing color blends

### Cursor
- Starts as 10px dot with `mix-blend-mode: difference`
- Grows to 150px ring on hover over interactive elements
- Smooth cubic-bezier easing on size transition (0.4s)

### Ghost Numerals
- Large background slide numbers (36vh, `-webkit-text-stroke`)
- Ultra-faint so they don't distract from foreground content

## Performance

- Responsive canvas with pixel-ratio clamping (max 2x)
- 14,000 particles on desktop, 7,000 on mobile
- Additive blending for particle glow effect
- Frustum culling disabled (particles always render)
- Breathing scale animation keeps scene feeling alive

## Credits

Designed and built for a talk on the balance between user research and designer intuition.
