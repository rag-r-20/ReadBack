---
name: ReadBack Industrial-Tech
colors:
  surface: '#121416'
  surface-dim: '#121416'
  surface-bright: '#37393b'
  surface-container-lowest: '#0c0e10'
  surface-container-low: '#1a1c1e'
  surface-container: '#1e2022'
  surface-container-high: '#282a2c'
  surface-container-highest: '#333537'
  on-surface: '#e2e2e5'
  on-surface-variant: '#c2c6d6'
  inverse-surface: '#e2e2e5'
  inverse-on-surface: '#2f3133'
  outline: '#8c909f'
  outline-variant: '#424754'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e6a'
  primary-container: '#4d8eff'
  on-primary-container: '#00285d'
  inverse-primary: '#005ac2'
  secondary: '#ffb690'
  on-secondary: '#552100'
  secondary-container: '#ec6a06'
  on-secondary-container: '#4a1c00'
  tertiary: '#fdbc15'
  on-tertiary: '#402d00'
  tertiary-container: '#ba8800'
  on-tertiary-container: '#382700'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#ffdbca'
  secondary-fixed-dim: '#ffb690'
  on-secondary-fixed: '#341100'
  on-secondary-fixed-variant: '#783200'
  tertiary-fixed: '#ffdea3'
  tertiary-fixed-dim: '#fdbc15'
  on-tertiary-fixed: '#261900'
  on-tertiary-fixed-variant: '#5d4200'
  background: '#121416'
  on-background: '#e2e2e5'
  surface-variant: '#333537'
  surface-slate: '#2C2E33'
  status-live: '#EF4444'
  status-safe: '#22C55E'
  status-review: '#F59E0B'
  zinc-100: '#F4F4F5'
typography:
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '800'
    lineHeight: 32px
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  technical-data:
    fontFamily: JetBrains Mono
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 20px
  technical-sm:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
  touch-target-min: 48px
---

## Brand & Style
The design system embodies "Industrial-Tech"—a fusion of heavy-duty reliability and high-performance intelligence. It is designed for electricians who require tools that work as hard as they do, often in demanding, low-light, or high-pressure environments.

The aesthetic blends **Corporate Modern** structure with **Brutalist** utility. It prioritizes high-contrast visibility and structural integrity. The UI should feel like a piece of high-end testing equipment: precise, rugged, and unmistakable. Large touch targets and high-readability typography ensure the interface remains functional for users wearing gloves or working in the field. To denote AI-powered insights, the system utilizes subtle glow effects and translucent "glass" overlays, signaling a layer of digital intelligence over physical hardware data.

## Colors
The palette is optimized for a dark-mode-first experience to reduce eye strain in varying site conditions. 

- **Primary (Electrical Blue):** Reserved for primary actions, active states, and focus indicators. 
- **Secondary (Safety Orange):** Used for critical alerts, warnings, and essential safety-related interactions.
- **Surface Tiers:** The base background uses Deep Charcoal (#1A1C1E), while Slate (#2C2E33) is used for cards and elevated containers to create structural depth.
- **Contrast:** Text is locked to high-contrast Zinc-100 or White to ensure legibility against dark backgrounds.
- **Functional Accents:** DeWalt-inspired Gold (#FEBD17) is used for secondary data highlights and specialized technical metrics.

## Typography
The typographic scale is built for rapid information scanning. 

- **Headlines:** Hanken Grotesk provides a sharp, contemporary "engineered" feel. Heavy weights (700-800) are used to establish a clear hierarchy.
- **Body:** Inter is the workhorse for all descriptive text, offering maximum legibility at various scales.
- **Technical Data:** JetBrains Mono is used exclusively for electrical ratings (e.g., 32A, 240V), breaker IDs, and AI-generated code or logs. This monospaced choice separates raw data from instructional text.
- **Accessibility:** Line heights are generous to prevent text crowding, and all labels use high-weight variations for clarity in low-light environments.

## Layout & Spacing
This design system uses a **fluid grid** with strict adherence to a 4px baseline shift. 

- **Grid:** A 12-column grid for desktop and a 4-column grid for mobile. 
- **Touch Readiness:** In accordance with the "gloved hand" requirement, all interactive elements have a minimum touch target of 48px. 
- **Rhythm:** Spacing between related items (like a label and an input) is 8px (2 units), while spacing between unrelated sections is 32px (8 units). 
- **Margins:** Consistent side margins of 16px on mobile ensure content doesn't bleed into the edges of ruggedized phone cases.

## Elevation & Depth
Depth is communicated through **Tonal Layers** rather than traditional shadows, which can appear muddy on dark backgrounds.

- **Level 0 (Base):** Deep Charcoal (#1A1C1E).
- **Level 1 (Cards):** Slate (#2C2E33) with a 1px solid border in a slightly lighter slate (#3F424A).
- **Level 2 (Modals/Popovers):** Elevated Slate with a subtle blue-tinted outer glow (#3B82F6 at 10% opacity) to signify digital "active" status.
- **AI Areas:** Sections containing AI-processed data utilize a frosted glass effect (Backdrop Blur: 12px) with a semi-transparent Slate fill to create a "heads-up display" (HUD) feeling.

## Shapes
Shapes are **Soft (0.25rem)** to mimic the chamfered edges of professional power tools. 

While the general UI remains structural and squared-off, a slight radius is applied to prevent the interface from feeling "sharp" or "pixelated." 
- Standard components (buttons, cards): 4px (rounded).
- Large containers: 8px (rounded-lg).
- Status Pills: 12px (rounded-xl) to provide a distinct visual shape compared to rectangular data fields.

## Components
- **Buttons:** High-visibility blocks. Primary buttons use "Electrical Blue" with white bold text. Secondary buttons use a heavy Slate border with no fill.
- **Status Indicators:** Use a "Traffic Light" system. "Live" uses a pulsing Red glow; "Safe" uses a solid Green border; "Needs Review" uses an Amber fill with black text.
- **Heavy-Duty Cards:** Background is Slate (#2C2E33). They feature a 1px top-border in the primary color if they require action.
- **Input Fields:** Darker than the card background with a persistent 1px border. On focus, the border glows "Electrical Blue." Labels are always positioned above the field, never as placeholders, for persistent context.
- **Chips:** Monospaced font in small caps for categories like "B-Curve" or "RCBO," using the JetBrains Mono font.
- **AI Glow:** Any component that is "Thinking" or "AI-Optimized" should have a subtle, breathing blue outer glow (4px blur).