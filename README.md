# htmltopdf

Generate pixel-perfect PDFs from plain HTML files using Playwright and Tailwind CSS.

Everything about the output — page size, layout, styles, data — lives in a single `.html` file. One command turns it into a PDF.

```bash
npm run file -- templates/my-document.html
# ✓ PDF saved to output/my-document.pdf
```

## Features

- **One-file workflow** — page size, styles, data, and output path all configured inside the HTML file
- **Tailwind CSS** — utility classes are auto-detected and compiled at render time, no build step
- **Plain JavaScript** — embed data and render loops directly in a `<script>` block; it all runs before the PDF is captured
- **Partials / includes** — share headers, footers, or any fragment across multiple templates with `<include src="...">`
- **Programmatic API** — pass HTML/CSS strings directly from TypeScript when you need it

---

## Quick start

```bash
npm install
npm run file -- templates/template.html
```

> Playwright downloads a Chromium browser on first install. If it doesn't happen automatically, run `npx playwright install chromium`.

---

## Template format

Start from `templates/template.html` and fill in three sections:

### 1. PDF config *(optional)*

```html
<script type="application/json" id="pdf-config">
  {
    "output": "output/my-document.pdf",
    "media": "screen"
  }
</script>
```

| Field | Default | Description |
|---|---|---|
| `output` | `output/<filename>.pdf` | Where the PDF is saved |
| `media` | `"screen"` | `"screen"` or `"print"` |

### 2. Page size

Use standard CSS — any unit works.

```html
<style>
  @page { size: 8.5in 11in; }           /* controls PDF dimensions */
  html, body { width: 8.5in; height: 11in; margin: 0; padding: 0; }
</style>
```

Common sizes: `8.5in 11in` (Letter), `210mm 297mm` (A4), `3.5in 2in` (business card), `3in 5in` (index card)

### 3. Content

Use any HTML and Tailwind utility classes. Put dynamic data in a `<script>` block — it executes in a real Chromium browser before the PDF is captured.

```html
<body class="bg-white font-sans p-10">
  <h1 class="text-2xl font-bold">Hello, world</h1>

  <ul id="items"></ul>

  <script>
    const items = ['One', 'Two', 'Three'];
    document.getElementById('items').innerHTML =
      items.map(i => `<li class="text-sm text-slate-600">${i}</li>`).join('');
  </script>
</body>
```

---

## Partials

Share any HTML fragment across multiple templates:

```html
<!-- In your template -->
<include src="partials/header.html">
```

Partials are resolved before Tailwind runs, so utility classes inside them are picked up automatically. Partials can include other partials.

```
templates/
  partials/
    header.html    ← shared fragment
  card-1.html
  card-2.html
```

---

## Programmatic API

```ts
import { renderPdf, renderPdfFromFile } from './src/render';

// From an HTML file (recommended)
await renderPdfFromFile('templates/my-document.html');

// Inline HTML/CSS strings
await renderPdf({
  html: `<div class="card">Hello</div>`,
  css: `.card { background: #0f172a; color: white; }`,
  width: '3.5in',
  height: '2in',
  outputPath: 'output/card.pdf',
});
```

---

## Project structure

```
src/
  file.ts       ← CLI entry point  (npm run file)
  render.ts     ← core rendering engine
  demo.ts       ← demo script      (npm run demo)
templates/
  template.html ← blank starter template
  partials/     ← shared HTML fragments
output/         ← generated PDFs land here
```

## Scripts

| Command | Description |
|---|---|
| `npm run file -- <template.html>` | Render a template to PDF |
| `npm run demo` | Run the demo template |
