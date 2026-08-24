# Building the Track4Trek homepage

This guide explains how the first public page at `siuyuk.xyz` is structured, how to run it, and how to publish changes safely.

## 1. What the homepage must accomplish

The homepage does not perform route analysis yet. Its job is to establish the project clearly:

1. Explain the problem in one sentence.
2. Show a believable example of the future result.
3. Explain the three-step user journey.
4. Establish trust through transparent methodology and open-source infrastructure.
5. Show what has been completed and what will be built next.

The primary message is: **Know what the trail asks of you.**

## 2. Main project files

- `app/page.tsx` contains the homepage structure and written content.
- `app/globals.css` controls the colours, typography, layout, cards, responsive behaviour, and accessibility states.
- `app/layout.tsx` contains the page title, search/social description, and social-preview image.
- `public/og.png` is the image displayed when the website link is shared.
- `docs/open-source-stack.md` records the technical stack decision.

## 3. Run the page locally

Install Node.js 22 or later and pnpm. Open a terminal in the project folder and run:

```powershell
pnpm install
pnpm dev
```

Open the local address printed in the terminal. Changes to `page.tsx` or `globals.css` should appear automatically.

## 4. Understand the page structure

The homepage is divided into these sections:

1. **Navigation:** project name and anchors to important sections.
2. **Hero:** headline, explanation, calls to action, and a sample route-demand card.
3. **Purpose strip:** distinguishes the project from a normal route directory.
4. **How it works:** upload, set the attempt, and read the demand.
5. **Method:** explains ranges, reasons, open infrastructure, and validation.
6. **Open stack:** names the main mapping and analysis providers.
7. **Project status:** shows the development roadmap.
8. **Footer:** provides a concise project description.

## 5. Edit content without breaking the layout

Open `app/page.tsx`. Most visible wording is ordinary text inside headings and paragraphs. Keep the main headline short. If a section paragraph becomes much longer, check the mobile layout afterward.

The `steps` and `openStack` arrays near the top of the file generate repeated cards and labels. Add or edit items there rather than copying whole HTML blocks.

## 6. Edit the design

Open `app/globals.css`. The colour system is defined at the beginning:

```css
:root {
  --ink: #0a1720;
  --forest: #123c33;
  --lime: #d9ff45;
  --paper: #f4f1e8;
}
```

Change these variables to update the visual identity consistently. Responsive rules are grouped at the bottom under `@media` blocks. Test at desktop and mobile widths after changing spacing, font sizes, or grid columns.

## 7. Add the real analyzer later

The next feature should be a separate `/analyze` page. Build it in this order:

1. GPX file input and error messages.
2. GPX-to-GeoJSON conversion.
3. MapLibre map and OpenFreeMap basemap.
4. Route preview and statistics.
5. Activity, pack weight, and target moving-time form.
6. Elevation requests and profile chart.
7. Demand model and explainable results.
8. Weather timeline.

Only change the homepage's main button to `/analyze` after that route works in the deployed site.

## 8. Validate before publishing

Run:

```powershell
pnpm build
```

Then verify:

- Navigation links reach the correct section.
- No horizontal scrolling appears on mobile.
- Text remains readable at 200% zoom.
- Keyboard focus is visible on every link.
- The sample card is identified as illustrative.
- The title and sharing image use the correct `siuyuk.xyz` branding.

## 9. Publish and connect the domain

Publish the verified build through the configured hosting service. When connecting the Dynadot domain:

1. Add `siuyuk.xyz` and optionally `www.siuyuk.xyz` to the hosting project.
2. Copy the exact A, CNAME, and verification records supplied by the host.
3. Add those records in Dynadot's DNS settings.
4. Do not delete unrelated email or verification records.
5. Wait for DNS and HTTPS activation.
6. Test both the root and `www` addresses, and redirect one to the other.

Never copy DNS values from an old tutorial; use the values shown by the current hosting project.

## 10. Recommended working rhythm

For every page or feature:

1. Define what “finished” means.
2. Build the smallest complete version.
3. Test it locally with a realistic route or scenario.
4. Run the production build.
5. Publish a preview.
6. Ask users to try it without instructions.
7. Record what changed because of their feedback.

This evidence will be useful in the university application because it demonstrates an engineering process rather than only a polished final screen.
