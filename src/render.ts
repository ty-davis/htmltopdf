// src/render.ts
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';

// ── Programmatic API (inline HTML/CSS) ───────────────────────────────────────

export type RenderPdfOptions = {
  html: string;
  css?: string;
  width: string;
  height: string;
  outputPath: string;
  media?: 'screen' | 'print';
};

export async function renderPdf({
  html,
  css = '',
  width,
  height,
  outputPath,
  media = 'screen',
}: RenderPdfOptions) {
  const fullHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html { font-size: 16px; }
      @page { size: ${width} ${height}; margin: 0; }
      html, body { width: ${width}; height: ${height}; margin: 0; padding: 0; }
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      ${css}
    </style>
  </head>
  <body>${html}</body>
</html>`;

  await renderToPage(fullHtml, media, outputPath);
}

// ── File-based API (everything configured inside the HTML file) ──────────────

type PdfConfig = {
  output?: string;
  media?: 'screen' | 'print';
};

/**
 * Read the optional <script type="application/json" id="pdf-config"> block.
 * All fields are optional — sensible defaults are applied in renderPdfFromFile.
 */
function parsePdfConfig(html: string): PdfConfig {
  const match = html.match(/<script[^>]+id=["']pdf-config["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return {};
  try {
    return JSON.parse(match[1].trim());
  } catch {
    return {};
  }
}

async function generateTailwindCss(html: string): Promise<string> {
  const result = await postcss([
    tailwindcss({ content: [{ raw: html, extension: 'html' }] }),
  ]).process('@tailwind base;\n@tailwind components;\n@tailwind utilities;', {
    from: undefined,
  });
  return result.css;
}

/**
 * Render a self-contained HTML template to PDF.
 *
 * Everything is driven by the HTML file:
 *   - Page size   →  CSS  @page { size: 8.5in 11in; }
 *   - Body size   →  CSS  html, body { width: 8.5in; height: 11in; }
 *   - Styles      →  any CSS / Tailwind utility classes
 *   - Output path and media type  →  <script type="application/json" id="pdf-config">
 *
 * Returns the path the PDF was written to.
 */
export async function renderPdfFromFile(templatePath: string): Promise<string> {
  const raw = await fs.readFile(templatePath, 'utf-8');

  // Resolve <include src="..."> tags before anything else
  const html = await resolveIncludes(raw, path.dirname(templatePath));

  const config = parsePdfConfig(html);

  const outputPath =
    config.output ??
    path.join('output', path.basename(templatePath, path.extname(templatePath)) + '.pdf');

  const media = config.media ?? 'screen';

  // Tailwind scans the fully-resolved HTML so classes inside partials are included
  const tailwindCss = await generateTailwindCss(html);

  // Inject only the two rules Playwright needs — never touch @page size or body dimensions
  const pdfBase = `
    @page { margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  `;

  const styledHtml = html.replace(
    '</head>',
    `<style>${pdfBase}\n${tailwindCss}</style>\n</head>`
  );

  await renderToPage(styledHtml, media, outputPath);
  return outputPath;
}

/**
 * Replace every <include src="path/to/partial.html"> with the contents of
 * that file, resolved relative to the including file's directory.
 * Supports recursive includes (partials that include other partials).
 */
async function resolveIncludes(html: string, baseDir: string): Promise<string> {
  // Temporarily mask HTML comments so <include> tags inside them are ignored
  const comments: string[] = [];
  const masked = html.replace(/<!--[\s\S]*?-->/g, (c) => {
    comments.push(c);
    return `<!--__COMMENT_${comments.length - 1}__-->`;
  });

  const tag = /<include\s+src=["']([^"']+)["']\s*\/?>/gi;
  const matches = [...masked.matchAll(tag)];

  let resolved = masked;
  for (const [fullMatch, src] of matches) {
    const includePath = path.resolve(baseDir, src);
    const partialRaw = await fs.readFile(includePath, 'utf-8');
    const partialResolved = await resolveIncludes(partialRaw, path.dirname(includePath));
    resolved = resolved.replace(fullMatch, partialResolved);
  }

  // Restore original comments
  return resolved.replace(/<!--__COMMENT_(\d+)__-->/g, (_, i) => comments[Number(i)]);
}

// ── Shared Playwright renderer ───────────────────────────────────────────────

async function renderToPage(html: string, media: 'screen' | 'print', outputPath: string) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1600 }, deviceScaleFactor: 1 });

  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.emulateMedia({ media });

  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    await Promise.all(
      Array.from(document.images).map(img =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>(resolve => {
              img.addEventListener('load', () => resolve(), { once: true });
              img.addEventListener('error', () => resolve(), { once: true });
            })
      )
    );
  });

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await page.pdf({
    path: outputPath,
    preferCSSPageSize: true,
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  });

  await browser.close();
}