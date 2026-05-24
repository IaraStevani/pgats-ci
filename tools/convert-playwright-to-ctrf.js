#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const input = process.argv[2] || 'test-results/playwright-results.json';
const output = process.argv[3] || 'test-results/ctrf-report.json';

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error(`Não foi possível ler/parsear ${file}:`, e.message);
    process.exit(2);
  }
}

function collectTestsFromSuite(suite, out) {
  if (!suite) return;
  if (Array.isArray(suite.tests)) {
    for (const t of suite.tests) {
      out.push({
        name: t.title || t.name || '',
        status: t.status || 'unknown',
        durationMs: t.duration || t.durationMs || null,
        error: t.err && (t.err.message || t.err),
      });
    }
  }
  if (Array.isArray(suite.suites)) {
    for (const s of suite.suites) collectTestsFromSuite(s, out);
  }
}

const data = readJson(input);
let tests = [];

if (Array.isArray(data.tests)) {
  for (const t of data.tests) {
    tests.push({
      name: t.title || t.name || '',
      status: t.status || 'unknown',
      durationMs: t.duration || t.durationMs || null,
      error: t.err && (t.err.message || t.err),
    });
  }
} else if (data.suites) {
  collectTestsFromSuite(data, tests);
} else if (data.result && Array.isArray(data.result.tests)) {
  for (const t of data.result.tests) {
    tests.push({
      name: t.title || t.name || '',
      status: t.status || 'unknown',
      durationMs: t.duration || t.durationMs || null,
      error: t.err && (t.err.message || t.err),
    });
  }
} else {
  // Fallback: try to find nested tests anywhere
  function search(obj) {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      for (const item of obj) search(item);
      return;
    }
    if (obj.title && obj.status) {
      tests.push({ name: obj.title, status: obj.status, durationMs: obj.duration || null, error: obj.err && obj.err.message });
    }
    for (const k of Object.keys(obj)) search(obj[k]);
  }
  search(data);
}

const summary = { total: tests.length, passed: 0, failed: 0, skipped: 0, durationMs: 0 };
for (const t of tests) {
  if (t.status === 'passed' || t.status === 'ok' || t.status === 'passed') summary.passed++;
  else if (t.status === 'skipped' || t.status === 'pending') summary.skipped++;
  else summary.failed++;
  if (t.durationMs) summary.durationMs += Number(t.durationMs) || 0;
}

const ctrf = {
  format: 'CTRF',
  version: '1.0',
  generatedAt: new Date().toISOString(),
  summary,
  tests,
};

// garante que a pasta existe
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(ctrf, null, 2), 'utf8');
console.log(`CTRF escrito em ${output}`);
