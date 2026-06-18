#!/usr/bin/env node
// Generates static/llms.txt from the docs/ directory.
// Run automatically via the "prebuild" npm script.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const DOCS_DIR = new URL('../docs', import.meta.url).pathname;
const OUT_FILE = new URL('../static/llms.txt', import.meta.url).pathname;
const FULL_FILE = new URL('../static/llms-full.txt', import.meta.url).pathname;
const SITE_URL = 'https://iarejula-bsc.github.io/dmr_doc';

function getTitle(content) {
  const m = content.match(/^title:\s*(.+)$/m);
  return m ? m[1].trim() : null;
}

// Remove the leading YAML frontmatter block so only the body markdown remains.
// The body keeps ```mermaid fences verbatim, so diagrams reach LLMs as text.
function stripFrontmatter(content) {
  return content.replace(/^---\n[\s\S]*?\n---\n+/, '');
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
      entries.push({ title: title || rel, path: rel, body: stripFrontmatter(content) });
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

const fullLines = [
  '# DMR Documentation — full content',
  '> Dynamic MPI Reconfiguration library by the Barcelona Supercomputing Center.',
  '> Mermaid diagrams are included as their source text so they remain machine-readable.',
  '',
  `Source: ${SITE_URL}`,
];

for (const p of pages) {
  fullLines.push('', '---', '', `# ${p.title}`, `Source: ${SITE_URL}/${p.path}/`, '', p.body.trim());
}

writeFileSync(FULL_FILE, fullLines.join('\n') + '\n');
console.log(`llms-full.txt written with ${pages.length} pages.`);
