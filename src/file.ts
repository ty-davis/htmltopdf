// src/file.ts — CLI entry point
// Usage: npm run file -- templates/project.html
import path from 'node:path';
import { renderPdfFromFile } from './render';

const templatePath = process.argv[2];

if (!templatePath) {
  console.error('Usage: npm run file -- <template.html>');
  process.exit(1);
}

renderPdfFromFile(path.resolve(templatePath))
  .then(outputPath => console.log(`✓ PDF saved to ${outputPath}`))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
