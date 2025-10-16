# Event Logistics Management System - Design Guidelines

## Design Approach

**System Selected**: Material Design / Enterprise Data-Driven UI  
**Rationale**: This is a utility-focused operational tool requiring information density, clear data hierarchy, and efficient workflows. Material Design principles provide the structure needed for complex data tables, status tracking, and multi-step processes while maintaining visual clarity.

**Key Principles**:
- Operational efficiency over aesthetics
- Data density with breathing room
- Clear visual hierarchy for status and alerts
- Keyboard-first interactions with mouse support
- Consistent patterns across all modules

---

## Core Design Elements

### A. Color Palette

**Primary Colors**:
- **Dark Blue (Primary)**: 222 84% 5% - App backgrounds, navigation bar, primary buttons
- **Light Blue (Secondary)**: 199 89% 48% - Active states, focused borders, CTAs, links
- **Pink (Accent 1)**: 330 81% 60% - Soft alerts, modification indicators, warnings
- **Purple (Accent 2)**: 258 90% 66% - Status tags, chips, progress indicators

**Neutrals**:
- Gray 900: 220 26% 14% - Dark text, borders
- Gray 700: 217 19% 27% - Secondary text
- Gray 500: 220 9% 46% - Disabled text, placeholders
- Gray 100: 214 32% 91% - Light backgrounds, cards

**Semantic States**:
- Success: 160 84% 39% - Completed actions, confirmations
- Warning: 38 92% 50% - Attention needed, pending cutoff
- Error: 0 84% 60% - Missing items, conflicts, failures
- Info: 221 83% 53% - Informational messages, help

### B. Typography

**Font Stack**: Inter (via Google Fonts CDN), system-ui fallback

**Scale**:
- H1: 2rem (32px), font-weight 700 - Module titles
- H2: 1.5rem (24px), font-weight 600 - Section headers
- H3: 1.25rem (20px), font-weight 600 - Card headers
- Body: 0.875rem (14px), font-weight 400 - Default text (data-dense)
- Small: 0.75rem (12px), font-weight 400 - Table metadata, captions
- Label: 0.875rem (14px), font-weight 500 - Form labels, chip text

**Line Heights**: 1.5 for body, 1.2 for headings

### C. Layout System

**Spacing Units**: Tailwind units of 1, 2, 3, 4, 6, 8, 12, 16, 24  
(p-1, m-2, gap-4, space-y-6, p-8, mb-12, py-16, mt-24)

**Grid System**:
- Container: max-w-7xl with px-6
- Sidebar: Fixed 280px width (w-70)
- Main content: flex-1 with px-8 py-6
- Dashboard cards: 2-4 column grid (grid-cols-2 lg:grid-cols-4)

**Responsive Breakpoints**:
- Desktop (default): 1440px+ optimized
- Tablet: md: (768px+) for dock operations
- Mobile: Limited support, tablet minimum

### D. Component Library

**Data Tables**:
- Dense rows with 36px height
- Sticky headers with sort indicators
- Inline filters in header row
- Row hover: bg-gray-100 dark:bg-gray-800
- Selected row: border-l-4 border-blue-400
- Status chips in cells (rounded-full px-3 py-1)

**Status Chips**:
- Rounded-full badges with colored backgrounds
- Icons optional (left side, 16px)
- Size: px-3 py-1, text-xs font-medium
- Color-coded by state (purple for in-progress, green for complete, pink for pending)

**Side Panels**:
- Slide from right, w-96 to w-1/3
- Header with close button (top-right)
- Scrollable content area
- Action footer (sticky bottom)

**Progress Bars**:
- Event/vehicle loading: h-2 rounded-full bg-gray-200
- Fill: bg-blue-500 transition-all duration-300
- Show percentage label above (text-sm font-medium)

**Forms**:
- Labels above inputs (text-sm font-medium mb-1)
- Input: rounded-md border border-gray-300 px-3 py-2 h-10
- Focus: ring-2 ring-blue-500 border-blue-500
- Dark mode: bg-gray-900 border-gray-700

**Scanning Interface**:
- Large scan target area (min-h-96)
- Real-time feedback on scan
- Alert badges: Red (wrong item), Yellow (excess), Green (correct)
- Sound/vibration confirmation

**Alert Modals**:
- Use sparingly - only for critical confirmations
- Overlay: bg-black/50
- Content: max-w-md rounded-lg shadow-xl
- Action buttons: right-aligned, primary + secondary

**Navigation**:
- Top bar: h-16 bg-dark-blue with logo left, profile right
- Sidebar: Collapsible with icons + labels
- Active state: bg-blue-900 border-l-4 border-blue-400
- Breadcrumbs: text-sm with chevron separators

**Empty States**:
- Centered icon (64px, text-gray-400)
- Title: text-lg font-medium text-gray-900
- Description: text-sm text-gray-500
- Primary action button below

### E. Interactions & Animations

**Transitions**: Use minimal, functional animations only
- Panel slides: duration-300 ease-out
- Status changes: duration-200 ease-in-out
- Hover states: duration-150
- No decorative animations

**Keyboard Shortcuts** (always visible in tooltips):
- Enter: Confirm/Submit
- Space: Toggle checkbox/mark item
- F: Focus filter
- Esc: Close panel/modal
- Arrow keys: Navigate tables

**Feedback Patterns**:
- Toast notifications: top-right, auto-dismiss 5s
- Inline validation: below input, text-sm text-red-600
- Loading states: Spinner + "Loading..." text
- Success: Green checkmark + message

---

## Module-Specific Guidelines

**Dashboard**: 
- KPI cards: 4-column grid, h-32, with large metric (text-3xl) and trend icon
- Timeline view: Vertical line with event nodes, color-coded by status
- Conflict panel: Red-bordered cards with suggested actions

**Event Planning**:
- Event card: White bg, shadow-sm, p-6, with status chip top-right
- Cutoff indicator: Countdown timer with warning colors as deadline approaches
- Kit selector: Grid of cards with parameters (dropdowns) and preview

**Loading Interface**:
- Split view: Truck diagram left (40%), item list right (60%)
- Item list: Scannable barcodes, large checkboxes, quantity input
- Progress banner: Sticky top showing items loaded/total per vehicle

**Return Logistics**:
- Expected vs. Actual: Side-by-side comparison table
- Damage registration: Photo upload grid (max 4 per item)
- Discrepancy form: Inline with red highlight on differences

**Inventory**:
- Stock levels: Visual bars (green >min, yellow <min, red out)
- Projection timeline: Horizontal bar chart by date showing ins/outs
- Alternative items: Expandable row with substitution rules

---

## Images

This is a data-heavy operational tool - **no hero images**. Use icons and diagrams instead:

- **Dashboard**: Icon-based KPI cards (truck, box, alert icons from Heroicons)
- **Empty states**: Illustration-style icons (no photos)
- **Product catalog**: Actual product photos (square thumbnails, 80x80px)
- **Damage reports**: User-uploaded photos in grid layout
- **Vehicle diagrams**: Simple SVG truck/container outlines for loading visualization

---

## Dark Mode Implementation

Default: Dark mode enabled for warehouse/operational environments

- Background: 222 84% 5% (dark blue)
- Surface: 220 26% 14% (gray-900)
- Text primary: 214 32% 91% (gray-100)
- Text secondary: 220 9% 46% (gray-500)
- Borders: 217 19% 27% (gray-700)
- All form inputs: Dark backgrounds with lighter borders on focus