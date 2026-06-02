#!/usr/bin/env node
// Generates static/llms.txt from the docs/ directory.
// Run automatically via the "prebuild" npm script.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const DOCS_DIR = new URL('../docs', import.meta.url).pathname;
const OUT_FILE = new URL('../static/llms.txt', import.meta.url).pathname;
const SITE_URL = 'https://your-dmr-docs-site.example.com';

function getTitle(content) {
  const m = content.match(/^title:\s*(.+)$/m);
  return m ? m[1].trim() : null;
}

function walkDocs(dir) {
  const entries = [];
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      entries.push(...walkDocs(full));
    } else if (name.endsWith('.md') || name.endsWith('.mdx')) {
      const content = readFileSync(full, 'utf8');
      const title = getTitle(content);
      const rel = relative(DOCS_DIR, full).replace(/\.mdx?$/, '').replace(/\\/g, '/');
      entries.push({ title: title || rel, path: rel });
    }
  }
  return entries;
}

const pages = walkDocs(DOCS_DIR);

const lines = [
  '# DMR Documentation',
  '> Dynamic MPI Reconfiguration library by the Barcelona Supercomputing Center.',
  '',
  `Source: ${SITE_URL}`,
  '',
  '## Pages',
  '',
  ...pages.map(p => `- [${p.title}](${SITE_URL}/${p.path}/)`),
  '',
  '## Full content',
  `> For the full content of each page see ${SITE_URL}/llms-full.txt`,
];

writeFileSync(OUT_FILE, lines.join('\n'));
console.log(`llms.txt written with ${pages.length} pages.`);
