# Design - 智途云枢

A locked design system for this traffic operations app. Every page keeps the same product chrome, token set, and interaction voice.

## Genre
modern-minimal

## Macrostructure Family
- App pages: Workbench. Dense operational views with map/chart panels, compact controls, and status-first hierarchy.
- Content pages: Long document only if future documentation pages are added.
- Marketing pages: Not used in this project.

## Theme
- `--color-paper` oklch(18% 0.028 228)
- `--color-panel` oklch(23% 0.032 224)
- `--color-ink` oklch(94% 0.018 220)
- `--color-muted` oklch(74% 0.035 220)
- `--color-rule` oklch(36% 0.035 222)
- `--color-accent` oklch(66% 0.15 218)
- `--color-focus` oklch(78% 0.16 210)

## Typography
- Display: Microsoft YaHei UI, weight 600, style normal.
- Body: Microsoft YaHei UI, weight 400.
- Outlier: DIN Alternate for clocks and large numeric KPIs only.
- Display tracking: 0.
- Type scale is defined in `tokens.css`.

## Spacing
4-point named scale. Pages use `var(--space-*)` tokens rather than raw spacing.

## Motion
- UI state changes use transform and opacity only.
- Easings are `--ease-out`, `--ease-in`, and `--ease-in-out`.
- Reduced motion collapses interaction transitions to 50 ms.

## Microinteractions Stance
- Silent success.
- Immediate focus rings.
- Compact hover treatment: color or background shift, never stacked effects.

## CTA Voice
- Primary actions use filled accent buttons with 4 px radius and one-line labels.
- Secondary actions use icon buttons or segmented controls.

## Per-page Allowances
- App pages do not use decorative enrichment. Maps, charts, route cards, and status panels carry the surface.

## What Pages Must Share
- Sidebar/bottom navigation structure.
- Blue-teal accent footprint.
- The same token file and Chinese system font stack.
- Panel border, radius, focus, and hover rules.

## What Pages May Differ On
- Panel arrangement and density.
- Chart accent within the existing status palette.
- Map/detail versus list/drawer layouts.
