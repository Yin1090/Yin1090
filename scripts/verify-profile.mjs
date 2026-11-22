#!/usr/bin/env node
/**
 * Zero-dependency verification gate for github-profile-Yin1090:
 *   1. Strict XML well-formedness, ID ref integrity, bounds & dual-theme SVG checks
 *   2. Deterministic config-to-README/preview/SVG byte-parity & alt-text validation
 *   3. Offline-only image enforcement & fragment-safe asset resolution
 *   4. Self-scanning privacy & exclusion scanner (NFC + ASCII-folded)
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateArtifacts } from './build-cards.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '..');
const ASSETS_DIR = join(ROOT_DIR, 'assets');
const CONFIG_PATH = join(ROOT_DIR, 'profile.config.json');
const README_PATH = join(ROOT_DIR, 'README.md');
const PREVIEW_PATH = join(ROOT_DIR, 'preview.html');

const decodeB64 = (b64) => Buffer.from(b64, 'base64').toString('utf8');
const foldAscii = (text) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');

const ENCODED_RULES = [
  ['excluded-repo', 'RkxJUi1UaGVybWFsLURhdGFzZXQtZm9yLVBlcnNvbi1EZXRlY3Rpb24='],
  ['excluded-repo', 'RmlyZS1BbGFybS1TeXN0ZW0tdmlkZW8t'],
  ['excluded-repo', 'Q0xJLUFueXRoaW5n'],
  ['excluded-repo', 'Zmxpci10aGVybWFs'],
  ['excluded-repo', 'ZmlyZS1hbGFybQ=='],
  ['academic-term', 'aHV0ZWNo'],
  ['academic-term', 'XGJmcHRcYg=='],
  ['academic-term', 'Y8O0bmcgbmdo4buHIHRwXC5oY20='],
  ['academic-term', 'xJHhuqFpIGjhu41j'],
  ['academic-term', 'dHLGsOG7nW5n'],
  ['academic-term', 'c2luaCB2acOqbg=='],
  ['academic-term', 'dW5pdmVyc2l0eQ=='],
  ['academic-term', 'Y29sbGVnZQ=='],
  ['academic-term', 'c3R1ZGVudA=='],
  ['academic-term', 'aOG7jWMgcGjhuqdu'],
  ['academic-term', 'dGnhu4N1IGx14bqtbg=='],
  ['academic-term', 'xJHhu5Mgw6FuIG3DtG4='],
  ['academic-term', 'Z2nhuqNuZyB2acOqbg=='],
  ['academic-term', 'XGJndmhkXGI='],
  ['academic-term', 'XGJndnBiXGI='],
  ['academic-term', 'MjNkcnRhMQ=='],
  ['academic-term', 'XGIoY2xvWzEtNl18Ym0wWzEzXXxxdDAzKVxi'],
  ['course-code', 'XGIobWV0MTYxfG1ldDQ2NnxjbXAxMDQpXGI='],
  ['enrollment-id', 'XGJtc3N2XGI='],
  ['enrollment-id', 'XGIyM1szOF02MzBcZHs0fVxi'],
  ['person-name', 'cGjhuqFtIHBob25nIHBow7o='],
  ['person-name', 'bmd1eeG7hW4gaG/DoG5nIG1pbmggdHXhuqVu'],
  ['person-name', 'aOG7kyBtaW5oIGtoYW5n'],
  ['person-name', 'bmd1eeG7hW4gdHLhuqduIHRoYW5oIHBob25n'],
  ['person-name', 'cGjhuqFtIHF14buRYyB0aGnhu4du'],
  ['person-name', 'cGjhuqFtIHF14buRYyBwaMawxqFuZw=='],
  ['person-name', 'bmfDtCBhbiB0aHV5w6pu'],
  ['person-name', 'a2hhbmdobzI2MTE='],
  ['person-name', 'XGJraGFuZ2hvXGI='],
  ['personal-handle', 'eWlubmd1eWVuMDYwOQ=='],
  ['personal-handle', 'L2hvbWUveWluLw=='],
  ['personal-handle', 'QzpcXFVzZXJzXFx0aW5iYQ=='],
  ['email-address', 'W2EtekEtWjAtOS5fJSstXStAW2EtekEtWjAtOS4tXStcLlthLXpBLVpdezIsfQ=='],
  ['private-ip', 'XGIxOTJcLjE2OFwuXGR7MSwzfVwuXGR7MSwzfVxi'],
  ['private-ip', 'XGIxMFwuXGR7MSwzfVwuXGR7MSwzfVwuXGR7MSwzfVxi'],
  ['private-ip', 'XGIxNzJcLigxWzYtOV18MlxkfDNbMDFdKVwuXGR7MSwzfVwuXGR7MSwzfVxi'],
  ['device-hotspot', 'cmVkbWlccyprNzA='],
  ['credential', 'bWluaGtoYW5n'],
  ['credential', 'YWRtaW4xMjM0NTY3ODk/'],
  ['credential', 'dHVhbm5ndXllbg=='],
  ['credential', 'YmFpdGhpZ2l1YWtp'],
  ['telegram-id', 'ODk0OTUzMTM5Nw=='],
  ['telegram-id', 'dGVsZWdyYW1fY2hhdF9pZA=='],
  ['telegram-id', 'XGJcZHs4LDEwfTpbQS1aYS16MC05Xy1dezM1fVxi'],
  ['legacy-builder', 'bWl0XHMqYXBwXHMqaW52ZW50b3I='],
  ['legacy-builder', 'YXBwXHMqaW52ZW50b3I='],
  ['legacy-builder', 'YXBwaW52ZW50b3I='],
  ['legacy-builder', 'a29kdWxhcg=='],
  ['legacy-builder', 'dGlueWRi'],
  ['legacy-builder', 'XC5haWFcYg=='],
  ['legacy-builder', 'XC5ia3lcYg=='],
  ['legacy-builder', 'XC5zY21cYg=='],
  ['legacy-builder', 'eGVfdmlfc2Fp'],
  ['legacy-builder', 'YWd2X25hdGl2ZV8z'],
  ['legacy-builder', 'YWd2X3N0ZXAxX21pbmltYWw='],
  ['legacy-builder', 'YWd2X2RyaXZlXzIy'],
  ['ungrounded-stack', 'XGIobmV4dFwuP2pzfHRhaWx3aW5kKD86XHMqY3NzfGNzcyk/fHBvc3RncmVzKD86cWwpP3xkb2NrZXJ8Z2l0aHViXHMqYWN0aW9ucylcYg=='],
];

function buildPrivacyMatchers() {
  const seen = new Set();
  const matchers = [];
  for (const [category, b64] of ENCODED_RULES) {
    const rawPattern = decodeB64(b64);
    for (const variant of [rawPattern, foldAscii(rawPattern)]) {
      const key = `${category}::${variant}`;
      if (seen.has(key)) continue;
      seen.add(key);
      matchers.push({ category, regex: new RegExp(variant, 'i') });
    }
  }
  return matchers;
}

const VALID_ENTITY_RE = /&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g;

function assertValidEntities(text, contextLabel, fileName) {
  const stripped = text.replace(VALID_ENTITY_RE, '');
  if (stripped.includes('&')) {
    throw new Error(`${fileName}: unescaped '&' in ${contextLabel}`);
  }
  if (stripped.includes('<')) {
    throw new Error(`${fileName}: raw '<' in ${contextLabel}`);
  }
}

function parseAttributes(attrText, fileName, tagName) {
  const attrs = {};
  let pos = 0;
  const len = attrText.length;

  while (pos < len) {
    while (pos < len && /\s/.test(attrText[pos])) pos++;
    if (pos >= len) break;

    const nameMatch = /^[A-Za-z_:][A-Za-z0-9_.:-]*/.exec(attrText.slice(pos));
    if (!nameMatch) {
      throw new Error(`${fileName}: invalid attribute syntax near "${attrText.slice(pos, pos + 24)}" on <${tagName}>`);
    }
    const name = nameMatch[0];
    pos += name.length;

    while (pos < len && /\s/.test(attrText[pos])) pos++;
    if (attrText[pos] !== '=') {
      throw new Error(`${fileName}: attribute "${name}" missing '=' on <${tagName}>`);
    }
    pos++;
    while (pos < len && /\s/.test(attrText[pos])) pos++;

    const quote = attrText[pos];
    if (quote !== '"' && quote !== "'") {
      throw new Error(`${fileName}: attribute "${name}" must be quoted on <${tagName}>`);
    }
    pos++;

    const closeIdx = attrText.indexOf(quote, pos);
    if (closeIdx === -1) {
      throw new Error(`${fileName}: unclosed quote for attribute "${name}" on <${tagName}>`);
    }
    const value = attrText.slice(pos, closeIdx);
    pos = closeIdx + 1;

    if (Object.prototype.hasOwnProperty.call(attrs, name)) {
      throw new Error(`${fileName}: duplicate attribute "${name}" on <${tagName}>`);
    }
    assertValidEntities(value, `attribute ${name}="${value}"`, fileName);
    attrs[name] = value;

    if (pos < len && !/\s/.test(attrText[pos])) {
      throw new Error(`${fileName}: missing whitespace after attribute "${name}" on <${tagName}>`);
    }
  }

  return attrs;
}

export function parseStrictXml(rawContent, fileName) {
  let content = rawContent.replace(/^\uFEFF/, '').trim();
  if (!content) {
    throw new Error(`${fileName}: XML document is empty`);
  }
  if (/<!DOCTYPE/i.test(content)) {
    throw new Error(`${fileName}: DOCTYPE declarations are disallowed`);
  }

  // Strip optional XML prolog only at start
  if (content.startsWith('<?xml')) {
    const prologEnd = content.indexOf('?>');
    if (prologEnd === -1) {
      throw new Error(`${fileName}: unclosed XML prolog`);
    }
    content = content.slice(prologEnd + 2).trimStart();
  }
  if (content.includes('<?xml')) {
    throw new Error(`${fileName}: XML prolog allowed only at start of file`);
  }

  // Validate and strip XML comments
  let cleaned = '';
  let idx = 0;
  while (idx < content.length) {
    const start = content.indexOf('<!--', idx);
    if (start === -1) {
      cleaned += content.slice(idx);
      break;
    }
    cleaned += content.slice(idx, start);
    const end = content.indexOf('-->', start + 4);
    if (end === -1) {
      throw new Error(`${fileName}: unclosed XML comment`);
    }
    const body = content.slice(start + 4, end);
    if (body.includes('--')) {
      throw new Error(`${fileName}: '--' disallowed inside XML comment`);
    }
    idx = end + 3;
  }

  const stack = [];
  const elements = [];
  let rootCount = 0;
  let rootTag = null;
  let pos = 0;

  while (pos < cleaned.length) {
    const lt = cleaned.indexOf('<', pos);
    if (lt === -1) {
      const trailing = cleaned.slice(pos);
      if (stack.length === 0 && trailing.trim() !== '') {
        throw new Error(`${fileName}: unexpected text outside root element`);
      }
      assertValidEntities(trailing, 'trailing text', fileName);
      break;
    }

    const textChunk = cleaned.slice(pos, lt);
    if (textChunk.length > 0) {
      if (stack.length === 0 && textChunk.trim() !== '') {
        throw new Error(`${fileName}: text before/outside root element`);
      }
      if (textChunk.includes('>')) {
        throw new Error(`${fileName}: stray '>' in text node`);
      }
      assertValidEntities(textChunk, 'text node', fileName);
      if (stack.length > 0) {
        stack[stack.length - 1].text += textChunk;
      }
    }

    const gt = cleaned.indexOf('>', lt + 1);
    if (gt === -1) {
      throw new Error(`${fileName}: unclosed '<' tag`);
    }
    const rawTag = cleaned.slice(lt + 1, gt);
    if (rawTag.includes('<')) {
      throw new Error(`${fileName}: nested '<' inside tag <${rawTag}>`);
    }
    pos = gt + 1;

    if (rawTag.startsWith('/')) {
      const closeName = rawTag.slice(1).trim();
      if (!/^[A-Za-z_:][A-Za-z0-9_.:-]*$/.test(closeName)) {
        throw new Error(`${fileName}: invalid closing tag </${closeName}>`);
      }
      if (stack.length === 0) {
        throw new Error(`${fileName}: unexpected closing tag </${closeName}>`);
      }
      const popped = stack.pop();
      if (popped.tag !== closeName) {
        throw new Error(`${fileName}: mismatched closing tag: expected </${popped.tag}>, got </${closeName}>`);
      }
      continue;
    }

    const selfClosing = rawTag.endsWith('/');
    const tagBody = (selfClosing ? rawTag.slice(0, -1) : rawTag).trim();
    const tagMatch = /^([A-Za-z_:][A-Za-z0-9_.:-]*)(?:\s+([\s\S]*))?$/.exec(tagBody);
    if (!tagMatch) {
      throw new Error(`${fileName}: malformed tag <${rawTag}>`);
    }

    const tagName = tagMatch[1];
    const attrString = tagMatch[2] || '';
    const attrs = attrString ? parseAttributes(attrString, fileName, tagName) : {};

    if (stack.length === 0) {
      rootCount++;
      rootTag = tagName;
    }

    const node = { tag: tagName, attrs, text: '' };
    elements.push(node);
    if (!selfClosing) {
      stack.push(node);
    }
  }

  if (stack.length > 0) {
    throw new Error(`${fileName}: unclosed tags at EOF: ${stack.map((s) => s.tag).join(', ')}`);
  }
  if (rootCount !== 1 || rootTag !== 'svg') {
    throw new Error(`${fileName}: expected single <svg> root, got count=${rootCount}, root=<${rootTag}>`);
  }

  return elements;
}

function decodeXmlEntities(text) {
  return String(text)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function estimateTextBounds(el) {
  const text = decodeXmlEntities(el.text.trim());
  const fontSize = Number(el.attrs['font-size'] ?? 11);
  const isMono = (el.attrs['font-family'] || '').includes('monospace');
  const charFactor = isMono ? 0.61 : 0.51;
  const estWidth = text.length * fontSize * charFactor;
  const x = Number(el.attrs.x ?? 0);
  const anchor = el.attrs['text-anchor'] || 'start';
  if (anchor === 'middle') {
    return { left: x - estWidth / 2, right: x + estWidth / 2, estWidth, text };
  }
  if (anchor === 'end') {
    return { left: x - estWidth, right: x, estWidth, text };
  }
  return { left: x, right: x + estWidth, estWidth, text };
}

function validateSvgSemantics(elements, fileName) {
  const root = elements[0];
  if (root.attrs.xmlns !== 'http://www.w3.org/2000/svg') {
    throw new Error(`${fileName}: root <svg> missing standard xmlns`);
  }
  const width = Number(root.attrs.width);
  const height = Number(root.attrs.height);
  if (!(width > 0 && height > 0)) {
    throw new Error(`${fileName}: invalid width/height (${root.attrs.width}x${root.attrs.height})`);
  }
  const vbMatch = /^0\s+0\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)$/.exec(root.attrs.viewBox || '');
  if (!vbMatch || Number(vbMatch[1]) !== width || Number(vbMatch[2]) !== height) {
    throw new Error(`${fileName}: viewBox "${root.attrs.viewBox}" must match ${width}x${height}`);
  }

  const declaredIds = new Set();
  const urlRefs = [];
  for (const el of elements) {
    if (el.attrs.id !== undefined) {
      if (!el.attrs.id) throw new Error(`${fileName}: empty id attribute`);
      if (declaredIds.has(el.attrs.id)) {
        throw new Error(`${fileName}: duplicate id="${el.attrs.id}"`);
      }
      declaredIds.add(el.attrs.id);
    }
    for (const attrName of ['clip-path', 'fill', 'stroke', 'filter']) {
      const val = el.attrs[attrName];
      if (val) {
        const refMatch = /url\(#([^)]+)\)/.exec(val);
        if (refMatch) urlRefs.push(refMatch[1]);
      }
    }
    if (el.tag === 'text') {
      if (!el.text.trim()) {
        throw new Error(`${fileName}: empty <text> node`);
      }
      const ty = Number(el.attrs.y);
      if (!(ty > 0 && ty < height)) {
        throw new Error(`${fileName}: <text> y=${el.attrs.y} outside 0..${height}`);
      }
      const bounds = estimateTextBounds(el);
      if (bounds.left < 0 || bounds.right > width) {
        throw new Error(
          `${fileName}: <text> "${bounds.text}" est [${bounds.left.toFixed(1)}, ${bounds.right.toFixed(1)}] overflows 0..${width}`
        );
      }
    }
    if (el.tag === 'rect') {
      const rx = Number(el.attrs.x ?? 0);
      const rw = Number(el.attrs.width ?? 0);
      if (rx < 0 || rx + rw > width) {
        throw new Error(`${fileName}: <rect> x=${rx}, width=${rw} overflows 0..${width}`);
      }
    }
  }

  for (const refId of urlRefs) {
    if (!declaredIds.has(refId)) {
      throw new Error(`${fileName}: unresolved url(#${refId}) reference`);
    }
  }

  if (fileName.startsWith('card-')) {
    const pillRects = elements.filter((el) => el.tag === 'rect' && el.attrs.y === '114');
    if (pillRects.length < 3 || pillRects.length > 4) {
      throw new Error(`${fileName}: expected 3..4 pill rects at y=114, found ${pillRects.length}`);
    }
    for (const pill of pillRects) {
      const px = Number(pill.attrs.x);
      const pw = Number(pill.attrs.width);
      if (px < 16 || px + pw > width - 16) {
        throw new Error(`${fileName}: pill rect [${px}, ${px + pw}] exceeds card margins`);
      }
    }
  }

  if (fileName.startsWith('snapshot-')) {
    const tileRects = elements
      .filter((el) => el.tag === 'rect' && Number(el.attrs.width) === 130 && Number(el.attrs.height) === 213)
      .map((el) => ({ x: Number(el.attrs.x), w: Number(el.attrs.width) }));
    if (tileRects.length !== 3) {
      throw new Error(`${fileName}: expected 3 snapshot tile rects, found ${tileRects.length}`);
    }
    for (const el of elements) {
      if (el.tag !== 'text') continue;
      const txCenter = Number(el.attrs.x ?? 0);
      const tile = tileRects.find((t) => txCenter >= t.x && txCenter <= t.x + t.w);
      if (!tile) continue;

      const bounds = estimateTextBounds(el);
      if (bounds.left < tile.x + 2 || bounds.right > tile.x + tile.w - 2) {
        throw new Error(
          `${fileName}: tile <text> "${bounds.text}" est [${bounds.left.toFixed(1)}, ${bounds.right.toFixed(1)}] overflows tile [${tile.x + 2}, ${tile.x + tile.w - 2}]`
        );
      }
      if (Number(el.attrs['font-size']) <= 9.6 && bounds.text.length > 20) {
        throw new Error(
          `${fileName}: tile subtitle "${bounds.text}" (${bounds.text.length} chars) exceeds 20-char line limit`
        );
      }
    }
  }
}

function verifySvgs(config) {
  const actualSvgs = readdirSync(ASSETS_DIR)
    .filter((f) => f.endsWith('.svg'))
    .sort();
  if (actualSvgs.length === 0) {
    throw new Error('No SVG files found in assets/');
  }

  const expectedPairs = [
    ...config.projects.map((p) => `card-${p.id}`),
    'tech-stack',
    'snapshot',
  ];

  const expectedSet = new Set();
  for (const prefix of expectedPairs) {
    expectedSet.add(`${prefix}-dark.svg`);
    expectedSet.add(`${prefix}-light.svg`);
  }

  for (const exp of expectedSet) {
    if (!actualSvgs.includes(exp)) {
      throw new Error(`Missing expected SVG: assets/${exp}`);
    }
  }
  for (const actual of actualSvgs) {
    if (!expectedSet.has(actual)) {
      throw new Error(`Stale unconfigured SVG found in assets/: ${actual}`);
    }
  }

  const parsedByFile = new Map();
  for (const file of actualSvgs) {
    const content = readFileSync(join(ASSETS_DIR, file), 'utf8');
    const elements = parseStrictXml(content, file);
    validateSvgSemantics(elements, file);
    parsedByFile.set(file, { content, elements });
  }

  // Dual-theme token & structural parity check
  for (const prefix of expectedPairs) {
    const darkName = `${prefix}-dark.svg`;
    const lightName = `${prefix}-light.svg`;
    const dark = parsedByFile.get(darkName);
    const light = parsedByFile.get(lightName);

    const darkSeq = dark.elements.map((e) => e.tag).join(',');
    const lightSeq = light.elements.map((e) => e.tag).join(',');
    if (darkSeq !== lightSeq) {
      throw new Error(`Dual-theme structural mismatch between ${darkName} and ${lightName}`);
    }
    if (!/#(0d1117|161b22|30363d|e6edf3)/i.test(dark.content) || /#ffffff/i.test(dark.content)) {
      throw new Error(`${darkName}: invalid dark theme palette tokens`);
    }
    if (!/#(ffffff|f6f8fa|d0d7de|1f2328)/i.test(light.content)) {
      throw new Error(`${lightName}: missing light theme palette tokens`);
    }
    const primarySurface = light.elements.find((e) => e.tag === 'rect');
    if (primarySurface && /#0d1117/i.test(primarySurface.attrs.fill || '')) {
      throw new Error(`${lightName}: primary surface uses dark canvas color`);
    }
  }

  return actualSvgs.length;
}

function verifySyncAndAssets(config) {
  if (config.username !== 'Yin1090') {
    throw new Error(`Unexpected username "${config.username}"`);
  }
  if (!config.bio || config.bio.length > 160) {
    throw new Error(`config.bio exceeds 160 chars (${config.bio?.length ?? 0})`);
  }

  const readme = readFileSync(README_PATH, 'utf8');
  const preview = readFileSync(PREVIEW_PATH, 'utf8');
  const expected = generateArtifacts(config);

  if (readme !== expected.readme) {
    throw new Error('README.md is out of sync with profile.config.json (run build-cards.mjs)');
  }
  if (preview !== expected.preview) {
    throw new Error('preview.html is out of sync with profile.config.json (run build-cards.mjs)');
  }
  for (const [fileName, expectedSvg] of expected.assets.entries()) {
    const actualSvg = readFileSync(join(ASSETS_DIR, fileName), 'utf8');
    if (actualSvg !== expectedSvg) {
      throw new Error(`assets/${fileName} is out of sync with profile.config.json`);
    }
  }

  // Blank lines inside <p align="left">...</p>
  const pBlocks = [...readme.matchAll(/<p\s+align="left">([\s\S]*?)<\/p>/gi)];
  for (const block of pBlocks) {
    if (/\r?\n\s*\r?\n/.test(block[1])) {
      throw new Error('README.md contains blank lines inside <p align="left">...</p>');
    }
  }

  // Clean alt text + offline-only image sources + fragment-safe asset checks
  for (const [label, doc] of [
    ['README.md', readme],
    ['preview.html', preview],
  ]) {
    const alts = [...doc.matchAll(/alt="([^"]*)"/g)];
    if (alts.length === 0) {
      throw new Error(`${label}: no alt attributes found`);
    }
    for (const m of alts) {
      const alt = m[1];
      if (!alt.trim()) {
        throw new Error(`${label}: empty alt attribute`);
      }
      if (/%[0-9A-Fa-f]{2}|--|_/.test(alt)) {
        throw new Error(`${label}: malformed/escaped alt text "${alt}"`);
      }
    }

    const imgRefs = [...doc.matchAll(/(?:src|srcset)="([^"]+)"/g)].map((m) => m[1]);
    for (const ref of imgRefs) {
      if (/^https?:\/\//i.test(ref)) {
        throw new Error(`${label}: external image URL disallowed ("${ref}")`);
      }
      if (ref.startsWith('./assets/')) {
        const cleanPath = ref.split('#')[0];
        const abs = resolve(ROOT_DIR, cleanPath);
        if (!statSync(abs, { throwIfNoEntry: true }).size) {
          throw new Error(`${label}: asset is empty ("${cleanPath}")`);
        }
      } else {
        throw new Error(`${label}: unexpected non-asset image reference ("${ref}")`);
      }
    }

    const hrefs = [...doc.matchAll(/<a\b[^>]*\bhref="([^"]+)"/gi)].map((m) => m[1]);
    for (const href of hrefs) {
      if (!href.startsWith('https://github.com/Yin1090') && !href.startsWith('#')) {
        throw new Error(`${label}: unexpected anchor href "${href}"`);
      }
    }
  }

  // Verify every card & summary uses both #gh-dark-mode-only and #gh-light-mode-only
  const pairs = [...config.projects.map((p) => `card-${p.id}`), 'tech-stack', 'snapshot'];
  for (const prefix of pairs) {
    const darkFrag = `./assets/${prefix}-dark.svg#gh-dark-mode-only`;
    const lightFrag = `./assets/${prefix}-light.svg#gh-light-mode-only`;
    if (!readme.includes(darkFrag) || !readme.includes(lightFrag)) {
      throw new Error(`README.md missing dual-theme fragments for ${prefix}`);
    }
    if (!preview.includes(darkFrag) || !preview.includes(lightFrag)) {
      throw new Error(`preview.html missing dual-theme fragments for ${prefix}`);
    }
  }
}

function collectAllFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectAllFiles(full, out);
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function verifyPrivacyGate() {
  const matchers = buildPrivacyMatchers();
  const files = collectAllFiles(ROOT_DIR).sort();
  const violations = [];

  for (const filePath of files) {
    const raw = readFileSync(filePath, 'utf8');
    const nfc = raw.normalize('NFC');
    const folded = foldAscii(raw);
    const rel = relative(ROOT_DIR, filePath);

    for (const { category, regex } of matchers) {
      if (regex.test(nfc) || regex.test(folded)) {
        violations.push(`${rel} [${category}]`);
        break;
      }
    }
  }

  if (violations.length > 0) {
    throw new Error(`Privacy/exclusion violations detected:\n  - ${violations.join('\n  - ')}`);
  }

  return files.length;
}

function main() {
  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  const svgCount = verifySvgs(config);
  verifySyncAndAssets(config);
  const scannedCount = verifyPrivacyGate();
  console.log(
    `[OK] Verified ${svgCount} SVGs (strict XML + dual-theme), deterministic config sync, offline-only assets, and ${scannedCount} privacy-clean files.`
  );
}

main();
