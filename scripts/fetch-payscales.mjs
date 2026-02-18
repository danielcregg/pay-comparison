#!/usr/bin/env node
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TUI_URL = 'https://www.tui.ie/third-level-pay-pensions/third-level-salary-scales-.2167.html';
const OUT_PATH = join(__dirname, '..', 'src', 'payscales.json');

function parseRows(tableHtml) {
  const rows = [];
  const rowRegex = /<tr>([\s\S]*?)<\/tr>/g;
  let m;
  while ((m = rowRegex.exec(tableHtml)) !== null) {
    const cells = [];
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
    let cm;
    while ((cm = cellRegex.exec(m[1])) !== null) {
      cells.push(cm[1]);
    }
    rows.push(cells);
  }
  return rows;
}

function parseSalary(cellHtml) {
  if (!cellHtml) return null;
  if (cellHtml.includes('<s>')) return null; // strikethrough = removed point
  const text = cellHtml.replace(/<[^>]*>/g, '').trim();
  const match = text.match(/€([\d,]+)/);
  return match ? parseInt(match[1].replace(/,/g, '')) : null;
}

function processSection(heading, tableHtml, scales) {
  if (heading.includes('Hourly Rate')) return; // skip hourly rates

  const rows = parseRows(tableHtml);
  if (rows.length < 2) return; // need at least header + 1 data row

  // Assistant Lecturer has two columns (pre/post 2011)
  if (heading === 'Assistant Lecturer' || (heading.includes('Assistant Lecturer') && !heading.includes('Hourly'))) {
    const firstRow = rows[0];
    const isMultiColumn = firstRow.length >= 2 &&
      firstRow.every(cell => cell.replace(/<[^>]*>/g, '').trim().length > 0);

    if (isMultiColumn) {
      const pre = [], post = [];
      for (const row of rows.slice(1)) {
        if (row.length >= 2) {
          const s1 = parseSalary(row[0]);
          const s2 = parseSalary(row[1]);
          if (s1) pre.push(s1);
          if (s2) post.push(s2);
        } else if (row.length === 1) {
          const s = parseSalary(row[0]);
          if (s) post.push(s);
        }
      }
      if (pre.length) scales['Assistant Lecturer (Pre-2011)'] = pre.map((s, i) => ({ point: i + 1, salary: s }));
      if (post.length) scales['Assistant Lecturer (Post-2011)'] = post.map((s, i) => ({ point: i + 1, salary: s }));
      return;
    }
  }

  // Long Service Increments - append to Lecturer/Lecturer 2
  if (heading.includes('Long Service')) {
    const lecKey = Object.keys(scales).find(k => k.includes('Lecturer') && (k.includes('Lecturer 2') || k.includes('Scale')));
    if (lecKey) {
      for (const row of rows.slice(1)) {
        for (const cell of row) {
          const s = parseSalary(cell);
          if (s && s > 1000) {
            const text = cell.replace(/<[^>]*>/g, '').trim();
            const lsMatch = text.match(/LS(\d)/);
            const len = scales[lecKey].length;
            scales[lecKey].push({ point: len + 1, salary: s, label: lsMatch ? `LS${lsMatch[1]}` : '' });
          }
        }
      }
    }
    return;
  }

  // Clean up heading
  let name = heading.replace(/\s+/g, ' ').trim();
  if (name.includes('Lecturer Scale')) name = 'Lecturer / Lecturer 2';

  // Single-column table
  const salaries = [];
  for (const row of rows.slice(1)) {
    for (const cell of row) {
      const s = parseSalary(cell);
      if (s && s > 1000) salaries.push(s);
    }
  }

  if (salaries.length > 0) {
    scales[name] = salaries.map((s, i) => ({ point: i + 1, salary: s }));
  }
}

async function main() {
  console.log('Fetching salary scales from TUI.ie...');

  let html;
  try {
    const res = await fetch(TUI_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (err) {
    console.error(`Fetch failed: ${err.message}`);
    if (existsSync(OUT_PATH)) {
      console.log('Keeping existing payscales.json');
      process.exit(0);
    }
    process.exit(1);
  }

  const bodyStart = html.indexOf('<div id="itemBody"');
  if (bodyStart === -1) {
    console.error('Could not find itemBody div in page');
    process.exit(1);
  }
  const content = html.substring(bodyStart);

  // Find all <strong> headings and <table> blocks with their positions
  const headings = [];
  const hRegex = /<strong>([\s\S]*?)<\/strong>/g;
  let m;
  while ((m = hRegex.exec(content)) !== null) {
    const text = m[1].replace(/<[^>]*>/g, '').trim();
    if (text && !text.includes('CLICK HERE') && !text.includes('Salary Scales in Techno')) {
      headings.push({ text, index: m.index });
    }
  }

  const tables = [];
  const tRegex = /<table[^>]*>([\s\S]*?)<\/table>/g;
  while ((m = tRegex.exec(content)) !== null) {
    tables.push({ html: m[1], index: m.index });
  }

  // Match each table to its closest preceding heading
  const scales = {};
  for (const table of tables) {
    const preceding = headings.filter(h => h.index < table.index);
    if (preceding.length === 0) continue;
    const heading = preceding[preceding.length - 1];
    processSection(heading.text, table.html, scales);
  }

  const output = {
    lastUpdated: new Date().toISOString().split('T')[0],
    source: TUI_URL,
    scales,
  };

  writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));
  console.log(`\nWritten ${Object.keys(scales).length} scales to src/payscales.json:`);
  for (const [name, points] of Object.entries(scales)) {
    console.log(`  ${name}: ${points.length} points (${points[0].salary.toLocaleString()} - ${points[points.length - 1].salary.toLocaleString()})`);
  }
}

main();
