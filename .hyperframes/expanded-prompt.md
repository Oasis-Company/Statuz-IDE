# Statuz IDE — YouTube Promotional Video v3 (60s · Premium Production)

## Brand Identity

**Product:** Statuz IDE — Topology-Aware Development Environment
**Company:** Oasis Company (`https://github.com/Oasis-Company`)
**Tagline:** "The end of text-only development."
**Core Formula:** Statuz IDE = VS Code (100% preserved) + Statuz Graph Engine (Rust)
**Core Thesis:** "Code is not text. Code is a graph."
**The Hook:** "Three queries. One graph. Everything else is a composition."
**Logo:** Three line segments + a circle — abstract topology graph representation

## Duration & Format

- **Duration:** 60 seconds
- **Resolution:** 1920×1080, 30fps
- **Audio:** Post-production (user-provided)
- **Voiceover:** Post-production (user-provided)
- **Captions:** English, built-in, bottom-center, white on dark semi-transparent bg

## Design System v3 — Premium Visual System

### Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-primary` | `#0A0A0A` | Main canvas |
| `--bg-secondary` | `#121212` | Panel/surface background |
| `--bg-tertiary` | `#1A1A1A` | Card/surface |
| `--bg-elevated` | `#242424` | Elevated surface |
| `--fg-primary` | `#FFFFFF` | Primary text |
| `--fg-secondary` | `#A0A0A0` | Body text |
| `--fg-tertiary` | `#666666` | Labels |
| `--accent` | `#007FD4` | Links, highlights, graph edges |
| `--accent-light` | `#4DB8FF` | Lighter accent for contrast |
| `--accent-glow` | `rgba(0,127,212,0.15)` | Ambient glow |
| `--accent-glow-heavy` | `rgba(0,127,212,0.3)` | Strong glow |
| `--border` | `#333333` | Dividers, card borders |
| `--border-light` | `#2A2A2A` | Subtle borders |
| `--success` | `#10B981` | Positive indicators |
| `--warning` | `#F59E0B` | Warning indicators |
| `--error` | `#EF4444` | Error indicators |
| `--vision` | `#8B5CF6` | Strategy Board — Vision card |
| `--user` | `#3B82F6` | Strategy Board — User card |
| `--problem` | `#F59E0B` | Strategy Board — Problem card |
| `--mvp` | `#10B981` | Strategy Board — MVP card |

### Logo — The Statuz Logo (MUST USE INLINE SVG IN EVERY SCENE)
```svg
<svg viewBox="0 0 256 256">
  <line x1="40" y1="184" x2="144" y2="168" stroke="currentColor" stroke-width="16" stroke-linecap="round"/>
  <line x1="144" y1="168" x2="112" y2="72" stroke="currentColor" stroke-width="16" stroke-linecap="round"/>
  <line x1="112" y1="72" x2="216" y2="56" stroke="currentColor" stroke-width="16" stroke-linecap="round"/>
  <circle cx="128" cy="120" r="20" fill="currentColor"/>
</svg>
```

### Typography
- Display: Inter (700-900 weight), letter-spacing: -0.5px to 0px
- Code: JetBrains Mono (monospace), font-size: 14-16px for code blocks
- Captions: Inter, 600 weight, 28px, bottom-center
- Labels: Inter, 500 weight, 14px, uppercase, letter-spacing: 2px

### Lighting System (MANDATORY — EVERY SCENE)
Every scene MUST have these 3 lighting layers:
1. **Ambient glow** — `radial-gradient(ellipse at center, var(--accent) 0%, transparent 60%)`, opacity 0.08-0.12, breathing animation
2. **Rim light** — `radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.04) 0%, transparent 50%)`, static
3. **Vignette** — `radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)`, static

### Particle System (MANDATORY — SCENES 1, 3, 4, 6)
Subtle floating particles in the background. 15-25 particles, each 2-4px circles, `#FFFFFF` at 0.02-0.04 opacity. Slow drift upward (y: -20 to -40px over 4-6s). Use gsap stagger.

### Ghost Text (MANDATORY — SCENES 1, 3, 4, 5, 6)
Large "STATUZ" text in background, 280-360px, Inter 900 weight, `#FFFFFF` at 0.015-0.03 opacity, subtle drift animation.

### Oasis Company Branding (MANDATORY — EVERY SCENE)
- Bottom-left corner: "OASIS COMPANY" text, 11px, Inter 500 weight, uppercase, letter-spacing: 3px, `#555555`
- Fades in at 1.0s into each scene
- This creates a consistent brand watermark throughout the video

### Statuz Logo (MANDATORY — EVERY SCENE)
- Bottom-right corner: 28px × 28px, `#FFFFFF`
- Fades in at 0.5s into each scene
- Breathing animation: scale 1 → 1.06 → 1 over 2s, sine.inOut, yoyo, repeat 2

### Fixed Decor Layers (EVERY SCENE)
1. **Radial glow** — accent-tinted ambient, 8-12% opacity, breathing
2. **Rim light** — top-center white gradient, 3-4% opacity
3. **Vignette** — dark corners overlay
4. **Ghost type** — "STATUZ" at 360px, 1.5-3% opacity, slow drift
5. **Grid pattern** — dot grid (16px spacing) or hairline grid, 3-4% opacity, subtle pulse
6. **Bottom rule** — 1px, `#333333`, scaleX from center, 60px from bottom
7. **Statuz Logo** — bottom-right, 28px, breathing
8. **Oasis Company** — bottom-left, 11px, uppercase, `#555555`, letter-spacing 3px

## Scene Structure

### Scene 1: Hook (0-4s) — "The topology era has begun."

**Visual:**
- Dark canvas with 3-layer lighting
- Ghostly "STATUZ" at 360px, 3% opacity, slow drift left
- Dot grid: 16px spacing, 3% opacity
- **Line 1**: "The text era is over." — types on character-by-character (0.035s stagger), 72px, Inter 800, centered
- At 2.0s: **Line 2**: "The topology era has begun." — slams in from below (y: 40 → 0, power3.out, 0.5s), 72px, Inter 800
- At 2.8s: "topology" highlighted with animated blue background sweep (#007FD4, 4px border-radius)
- At 3.2s: Bottom rule draws from center
- At 3.5s: Logo fades in bottom-right

**Timing:** 0-4s
**Logo:** Bottom-right, 28px
**Oasis:** Bottom-left, visible from 1.0s

### Scene 2: Problem (4-10s) — "VS Code shows you files. But it hides what your code really means."

**Visual:**
- VS Code interface: file tree (220px, left) + code editor (right)
- File tree slides in from left (power2.out, 0.4s)
- Code editor slides in from right (power2.out, 0.4s)
- Code: TypeScript syntax highlighting (12 lines, 14px, JetBrains Mono)
- At 1.2s: 4 red dashed lines (#EF4444) draw from import statements to their usage sites
- At 2.5s: Headline "VS Code lets you edit code." fades in (36px, Inter 400)
- At 4.0s: Subheadline "But it hides what your code really means." fades in (24px, Inter 300, #A0A0A0)
- Red lines pulse at 4.5s

**Timing:** 4-10s
**Logo:** Bottom-right, 28px
**Oasis:** Bottom-left

### Scene 3: Solution (10-17s) — PEAK MOMENT — "Statuz IDE. VS Code + Rust Graph Engine."

**Visual:**
- **This is the most visually impressive scene**
- 10 labeled graph nodes using FIXED DETERMINISTIC positions (NO Math.random())
- Each node: 24px circle with glow ring (12px outer, 3px, #007FD4 at 0.3 opacity)
- Nodes pulse with staggered wave animation
- 16 edges: 8 glowing (#007FD4, 2px, filter: url(#edgeGlow)) + 8 regular (#333333, 1.5px)
- Edges draw sequentially with stroke-dashoffset animation
- **Data flow**: 3 small particles (#007FD4, 3px circles) travel along 3 key edges simultaneously
- Nodes labeled with JetBrains Mono, 11px, #CCCCCC, with dark label background (#1A1A1A, 4px padding, 4px radius)
- At 1.0s: "Statuz IDE" reveals with clip-path (88px, Inter 800, #FFFFFF)
- At 2.0s: Formula "= VS Code + Rust Graph Engine" slides up (32px, Inter 400, #A0A0A0)
- At 2.5s: "Rust Graph Engine" highlights to #007FD4
- At 4.0s: "Built by Oasis Company" appears bottom-left

**Node labels:** api-gateway, auth-service, orchestrator, payment-service, cache-layer, rate-limiter, db-primary, db-replica, message-queue, cdn-layer

**Timing:** 10-17s
**Logo:** Bottom-right, 28px
**Oasis:** Bottom-left, "Built by Oasis Company"

### Scene 4: Three Queries (17-32s) — "Traverse. Impact. Path."

**Visual:**
- Split-screen: 55% graph (left) + 45% terminal (right)
- **PHASE 1: Traverse (17-22s)**
  - Query label cycles to "Traverse" (#007FD4, 24px, Inter 700)
  - Node 0 (api-gateway) scales 1.2x at 1.0s
  - Connected nodes (1,2,3) highlight to #007FD4 at 1.5s
  - Connected edges glow to #007FD4 at 1.5s
  - Terminal: `> traverse('api-gateway')` → `→ [auth, orchestrator, rate-limiter]`
- **PHASE 2: Impact (22-27s)**
  - Query label cycles to "Impact"
  - Node 4 (payment-service) shimmers
  - 2 concentric rings (#EF4444, 2px) expand from node 4 (r: 0 → 60)
  - Affected nodes (1,2,6) flash red then restore
  - Terminal: `> impact('payment-service')` → `→ 3 nodes · Critical path: YES`
- **PHASE 3: Path (27-32s)**
  - Query label cycles to "Path"
  - Node 0 turns green (#10B981), node 6 turns red (#EF4444)
  - Path glow edges appear
  - Animated dot travels from node 0 → node 1 → node 6 (2 segments)
  - Terminal: `> path('api-gateway', 'db-primary')` → `→ 2 steps: gateway → auth → db`

**8 nodes:** api-gateway, auth-service, orchestrator, rate-limiter, payment-service, cache-layer, db-primary, db-replica

**Timing:** 17-32s
**Logo:** Bottom-right, 28px
**Oasis:** Bottom-left

### Scene 5: DCR + Board (32-44s) — "Every decision is a commitment."

**Visual:**
- Grid background (60px spacing, 3% opacity)
- 4 strategy cards slide in from different directions:
  - Vision (purple #8B5CF6, 200×80px, 3px left border) — slides from top
  - User (blue #3B82F6) — slides from left
  - Problem (amber #F59E0B) — slides from right
  - MVP (green #10B981) — slides from bottom
- 5 connector lines draw between cards (2.0-3.5s):
  - informs (#A8A29E), constrains (#F59E0B), contradicts (#EF4444, dashed), validates (#10B981), extends (#3B82F6)
- 2 diamond decision nodes scale in (4.0s, 4.3s)
- Completeness ring (SVG circle, r=45, stroke=3px, #10B981) counts from 0 → 83% (5.0s)
- Counter text: 0% → 83% (tabular-nums, 32px, Inter 800, #10B981)
- Cards ambient breathing (6.0s)

**Timing:** 32-44s
**Logo:** Bottom-right, 28px
**Oasis:** Bottom-left

### Scene 6: AI Ecosystem (44-53s) — "16 providers. One unified architecture."

**Visual:**
- Ghost "AI" text at 600px, 1.5% opacity
- 4×4 grid of 16 provider cards (100×70px, #1A1A1A, 1px border #333333, 4px radius)
- Cards fly in from random offscreen positions with staggered animation (0.025s stagger)
- At 2.0s: Wave pulse — cards scale 1.05 then back
- At 3.5s: Cards dissolve (opacity 0, scale 0)
- At 4.0s: Pipeline assembles: User → Chat → MCP → Tools → Graph Engine
  - 5 boxes (160×60px, #1A1A1A, 1px border #333333)
  - 4 arrows between them (▶, #444444, 28px)
  - Staggered animation: 0.25s between each box
- At 5.5s: Graph Engine box highlights (border: #007FD4, box-shadow glow)
- At 5.5s: Headline "16 providers. One unified architecture." fades in (32px, Inter 700)
- At 7.0s: Subheadline "MCP, ECC, and 80+ built-in extensions" fades in (18px, Inter 400, #A0A0A0)

**16 providers:** Anthropic, OpenAI, Gemini, Groq, Mistral, DeepSeek, Ollama, xAI, OpenRouter, vLLM, LM Studio, Azure, Vertex, Bedrock, LiteLLM, OAI Compat

**Timing:** 44-53s
**Logo:** Bottom-right, 28px
**Oasis:** Bottom-left

### Scene 7: CTA (53-60s) — "The topology era has begun."

**Visual:**
- Background glow dims (opacity: 0 → 0.3, 5s, power2.in)
- **Statuz logo CENTERED at 100px** — appears at 0.5s with expo.out (scale 0.8 → 1, 0.7s)
- Logo ambient breathing: scale 1.03, 2s, sine.inOut, yoyo, repeat 1
- "Statuz IDE" at 64px, Inter 800 — fades in at 1.5s
- "Topology-Aware Development Environment" at 24px, Inter 400, #A0A0A0 — fades in at 2.5s
- 3 CTA buttons (240×50px, 2px border #333333, 4px radius, Inter 600, 16px):
  - "Download for Windows" — slides from left at 3.0s
  - "View on GitHub" — fades in at 3.5s
  - "Read the Docs" — slides from right at 4.0s
- "OASIS COMPANY" at 16px, #999999, uppercase, letter-spacing 2px — fades in at 4.5s
- "© 2025-2026 Oasis Company" at 14px, #666666 at 4.5s
- At 5.5s: All elements fade to black (1.5s, power2.in)

**Timing:** 53-60s
**Logo:** CENTERED, 100px
**Oasis:** Bottom center, prominent

## Transitions
- Scene 1→2: Blur crossfade, 0.3s, power2.inOut
- Scene 2→3: Blur crossfade, 0.3s, power2.inOut
- Scene 3→4: Blur crossfade, 0.3s, power2.inOut
- Scene 4→5: Blur crossfade, 0.3s, power2.inOut
- Scene 5→6: Blur crossfade, 0.3s, power2.inOut
- Scene 6→7: Blur crossfade, 0.3s, power2.inOut
- Scene 7→End: All elements fade to black, 1.5s, power2.in

## Caption Script (English)
| Time | Text |
|------|------|
| 0.5s | "The text era is over." |
| 2.0s | "The topology era has begun." |
| 4.5s | "VS Code lets you edit code." |
| 6.5s | "But it hides what your code really means." |
| 10.5s | "Statuz IDE." |
| 12.0s | "VS Code + Rust Graph Engine." |
| 14.0s | "Code is a graph." |
| 17.5s | "Traverse — what does this connect to?" |
| 22.0s | "Impact — if this changes, who is affected?" |
| 26.5s | "Path — how do I get from A to B?" |
| 32.5s | "Every decision is a commitment." |
| 38.0s | "Every drift is detectable." |
| 44.5s | "16 providers. One unified architecture." |
| 48.5s | "MCP, ECC, and 80+ built-in extensions." |
| 53.5s | "Statuz IDE — Topology-Aware Development." |
| 57.0s | "The topology era has begun." |

## CRITICAL RULES

### Animation Rules
1. **NO Math.random()** — all positions must be deterministic
2. **NO Math.round()** errors — use `parseInt()` or `Math.floor()` for integer rounding
3. **All positions must be absolute** (px values), no relative positioning for nodes
4. **Every scene must have its own timeline** registered as `window.__timelines["sceneN"]`
5. **No scene timeline should exceed the scene's duration**
6. Use `gsap.set()` for initial state, `gsap.fromTo()` for animations
7. Easing: `power3.out` for dramatic reveals, `power2.out` for standard, `sine.inOut` for breathing
8. **Font fallback**: Always include `"Inter", system-ui, -apple-system, sans-serif`
9. **Code font fallback**: Always include `"JetBrains Mono", "Fira Code", "Cascadia Code", monospace`

### Oasis Company Branding
- Every scene MUST include "OASIS COMPANY" at bottom-left
- Style: 11px, Inter 500, uppercase, letter-spacing 3px, #555555
- Fade in at 1.0s into each scene

### Statuz Logo
- Every scene MUST include the inline SVG logo at bottom-right
- Size: 28px × 28px
- Fade in at 0.5s, then breathing animation

### Scene 3 — Graph Node Positions (DETERMINISTIC)
```
cdn-layer:      (535, 350)
api-gateway:    (735, 400)
auth-service:   (985, 330)
orchestrator:   (1185, 450)
payment-service:(885, 570)
cache-layer:    (1085, 650)
rate-limiter:   (685, 530)
db-primary:     (1235, 630)
db-replica:     (1385, 550)
message-queue:  (935, 750)
```

### Scene 4 — Graph Node Positions (DETERMINISTIC)
```
api-gateway:    (300, 250)
auth-service:   (500, 180)
orchestrator:   (650, 280)
rate-limiter:   (350, 380)
payment-service:(550, 420)
cache-layer:    (700, 450)
db-primary:     (450, 550)
db-replica:     (650, 580)
```

## Negative Prompt
- No Math.random() — use deterministic arrays
- No gradient text (background-clip: text)
- No bouncy/elastic animations
- No neon colors beyond defined palette
- No emoji, no hand-drawn elements
- No centered layouts except CTA scene (intentional)
- No identical card grids (use varied sizes)
- No solid flat backgrounds — always texture (glow, grid, ghost)
- No font below 11px (labels only)
- No missing Oasis Company branding in any scene