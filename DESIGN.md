# Statuz IDE — Video Design System

> Swiss Style · Black & White · Minimalist · Tech

## Brand Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-primary` | `#0A0A0A` | Main canvas background |
| `--bg-secondary` | `#1A1A1A` | Card/surface background |
| `--bg-tertiary` | `#242424` | Elevated surface, hover states |
| `--fg-primary` | `#FFFFFF` | Primary text, headlines |
| `--fg-secondary` | `#A0A0A0` | Body text, metadata |
| `--fg-tertiary` | `#666666` | Labels, muted elements |
| `--accent` | `#007FD4` | Links, focus rings, highlights |
| `--accent-glow` | `rgba(0, 127, 212, 0.15)` | Ambient glow, decorative |
| `--border` | `#333333` | Dividers, card borders |
| `--border-light` | `#2A2A2A` | Subtle borders |
| `--success` | `#10B981` | Positive indicators |
| `--warning` | `#F59E0B` | Warning indicators |
| `--error` | `#EF4444` | Error indicators |
| `--vision` | `#8B5CF6` | Vision card (Strategy Board) |
| `--user` | `#3B82F6` | User card (Strategy Board) |
| `--problem` | `#F59E0B` | Problem card (Strategy Board) |
| `--mvp` | `#10B981` | MVP card (Strategy Board) |

## Typography

- **Primary font:** Inter (built-in, supported by HyperFrames compiler)
- **Monospace font:** JetBrains Mono (built-in, for code blocks)
- **Headline weights:** 700–900
- **Body weights:** 300–500
- **Label weights:** 500–600, uppercase, letter-spaced

## Mood

Confident, precise, editorial. Think Apple keynote visuals meets Swiss typographic poster. No playful elements, no hand-drawn anything, no multiple font families. Every element has a reason to exist.

## Depth System

- **Flat** — no box shadows. Rely on 1px borders and background contrast.
- **Elevation via border:** `1px solid var(--border)` on dark surfaces.
- **Glow:** reserved for accent elements only (code highlights, active states, buttons).

## Motion Language

- **Scene entrances:** `power3.out` or `expo.out` — decelerating, confident.
- **Scene exits (final scene only):** `power2.in` — fade to black.
- **Ambient motion:** `sine.inOut` — slow, breathing, continuous.
- **Data elements:** `power2.out` — quick, precise, mechanical.
- **Text reveals:** `power3.out` with slight y-offset (20–40px).

## Negative Prompts (What to Avoid)

- No gradient text (`background-clip: text`)
- No neon colors (cyan, purple-to-blue gradients)
- No hand-drawn elements or sketchy animations
- No playful bounces or elastic overshoots
- No multiple font families — Inter only for display, JetBrains Mono for code
- No emoji
- No centered-and-floating layouts — anchor to edges, use zones
- No identical card grids — vary sizes and positions
- No solid flat color backgrounds — always add texture (radial glow, ghost type, grid, grain)