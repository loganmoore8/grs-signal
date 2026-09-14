# UI reference and implementation

The interface uses Linear's public light-mode screenshots and design discussion as a visual reference, adapted to GRS Signal's existing procurement workflow. This is an app-specific implementation, not an imported official Linear component library or a claim of pixel-identical reproduction.

References inspected:

- [Linear's interface redesign](https://linear.app/now/how-we-redesigned-the-linear-ui): sidebar, compact navigation, headers, neutral surfaces and detail panels.
- [Linear display options](https://linear.app/docs/display-options): focused list layouts and selective property visibility.

Implemented in `apps/web/app/styles.css` and `apps/web/components/signal-app.tsx`:

- Pale fixed sidebar, small breadcrumb header, subtle gray separators and restrained indigo accents.
- Agency-first full-row opportunity buttons: the agency is the bold primary line, state is a quiet inline label, and the opportunity title sits beneath it. Deadline and fit remain aligned in two trailing columns, removing the redundant agency column. Exceptions such as closed, unverified or suppressed records remain explicit.
- Explanations, platform details, notes and pursuit actions are in the detail drawer. Pursue/undo, pass reasons, restore and all existing workflow statuses remain available.
- The same three navigation destinations collapse to a horizontal layout on mobile. Keyboard focus, dialog dismissal and source links remain supported.
- System font stack and inline SVG icons; no new dependencies, external font requests, services or runtime charges.

Design tokens and measurements are our own approximations based on the public references. Research, scoring, storage and Terraform behavior are unchanged by this UI revision.

Verification: TypeScript and all 61 existing tests passed; formatting and the production static build passed. Browser checks covered desktop and 390px mobile list/drawer layouts, pursue, undo, pass with a reason, and restore. No deployment was performed.

Follow-up verification: agency-first rows inspected at desktop and 390px widths, including expanded secondary matches and the detail drawer. TypeScript, all 61 existing tests and the production static build passed again.

Guided Reach branding pass: inspected [guidedreach.com](https://guidedreach.com/) and reused its [public compass mark](https://guidedreach.com/logo-nav.png), bundled unchanged as `apps/web/public/guided-reach-mark.png` (12 KB). The mark appears beside GRS Signal and as the favicon. A small “by Guided Reach” attribution, navy wordmark, muted gold active-navigation edge and pale gold next-action rule add brand identity while preserving the neutral surfaces and indigo controls. Gold accent tokens are subdued app-specific adaptations, not an official brand palette. Desktop and 390px mobile list/drawer inspections and the production build including TypeScript passed. No new dependencies or external runtime requests were added.
