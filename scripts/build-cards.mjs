#!/usr/bin/env node
/**
 * Deterministic generator for github-profile-Yin1090:
 * Reads profile.config.json and generates:
 *   - assets/card-<id>-{dark,light}.svg (420x172)
 *   - assets/tech-stack-{dark,light}.svg (852x148)
 *   - assets/snapshot-{dark,light}.svg (852x214)
 *   - README.md (offline-safe, #gh-dark-mode-only / #gh-light-mode-only)
 *   - preview.html (interactive 2-column GitHub Overview + tabs + theme toggle)
 */

import { mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '..');
const ASSETS_DIR = join(ROOT_DIR, 'assets');
const CONFIG_PATH = join(ROOT_DIR, 'profile.config.json');

const CARD_WIDTH = 420;
const CARD_HEIGHT = 172;
const CARD_LEFT = 18;
const CARD_RIGHT = 402;
const MAX_DESC_CHARS = 54;
const MAX_DESC_LINES = 3;

const TECH_WIDTH = 852;
const TECH_HEIGHT = 148;
const TECH_PILL_START_X = 184;
const TECH_PILL_RIGHT_MAX = 836;

const SNAPSHOT_WIDTH = 852;
const SNAPSHOT_HEIGHT = 214;

const FONT_SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const FONT_MONO = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace";

export function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitizeAltText(value) {
  return String(value)
    .replace(/--+/g, ' - ')
    .replace(/_/g, ' ')
    .replace(/%2F/gi, '/')
    .replace(/\s+/g, ' ')
    .trim();
}

export function wrapText(text, maxChars = MAX_DESC_CHARS, maxLines = MAX_DESC_LINES) {
  const words = String(text).trim().split(/\s+/);
  const lines = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }
    const candidate = `${current} ${word}`;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) {
    lines.push(current);
  }

  if (lines.length > maxLines) {
    throw new Error(
      `Description wrapped to ${lines.length} lines (max ${maxLines} at ${maxChars} chars): "${text}"`
    );
  }
  return lines;
}

function computeCardPillLayouts(tags) {
  if (!Array.isArray(tags) || tags.length < 3 || tags.length > 4) {
    throw new Error(`Project tags must contain 3..4 items, got ${tags?.length ?? 0}`);
  }
  const gap = 6;
  const height = 22;
  const y = 114;
  let cursorX = CARD_LEFT;

  return tags.map((label) => {
    const width = Math.max(46, Math.round(label.length * 6.3) + 16);
    if (cursorX + width > CARD_RIGHT) {
      throw new Error(
        `Card pill "${label}" overflows right bound (${cursorX + width} > ${CARD_RIGHT})`
      );
    }
    const layout = { label, x: cursorX, y, width, height };
    cursorX += width + gap;
    return layout;
  });
}

function renderCardIcon(iconName, accent) {
  switch (iconName) {
    case 'layers':
      return [
        `<path d="M8 2.2 13.8 5.2 8 8.2 2.2 5.2 8 2.2Z" stroke="${accent}" stroke-width="1.35" stroke-linejoin="round" fill="none"/>`,
        `<path d="M2.2 8 8 11 13.8 8" stroke="${accent}" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
        `<path d="M2.2 10.8 8 13.8 13.8 10.8" stroke="${accent}" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
      ].join('');
    case 'radar':
      return [
        `<circle cx="8" cy="8" r="5.5" stroke="${accent}" stroke-width="1.3" fill="none" opacity="0.45"/>`,
        `<circle cx="8" cy="8" r="2.8" stroke="${accent}" stroke-width="1.3" fill="none"/>`,
        `<circle cx="8" cy="8" r="1.1" fill="${accent}"/>`,
        `<path d="M8 8 12.2 3.8" stroke="${accent}" stroke-width="1.35" stroke-linecap="round"/>`,
      ].join('');
    case 'terminal':
      return [
        `<rect x="1.8" y="2.5" width="12.4" height="11" rx="2" stroke="${accent}" stroke-width="1.35" fill="none"/>`,
        `<path d="M4.6 6.2 7 8.2 4.6 10.2" stroke="${accent}" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
        `<path d="M8.5 10.2h3" stroke="${accent}" stroke-width="1.35" stroke-linecap="round" fill="none"/>`,
      ].join('');
    case 'eye':
      return [
        `<path d="M1.6 8s2.4-4.2 6.4-4.2S14.4 8 14.4 8s-2.4 4.2-6.4 4.2S1.6 8 1.6 8Z" stroke="${accent}" stroke-width="1.35" stroke-linejoin="round" fill="none"/>`,
        `<circle cx="8" cy="8" r="2.1" stroke="${accent}" stroke-width="1.35" fill="none"/>`,
      ].join('');
    case 'shield':
      return [
        `<path d="M8 2.1 13.2 4.2v3.9c0 3.2-2.2 5.4-5.2 6.3-3-.9-5.2-3.1-5.2-6.3V4.2L8 2.1Z" stroke="${accent}" stroke-width="1.35" stroke-linejoin="round" fill="none"/>`,
        `<path d="M5.7 8.1 7.3 9.7 10.5 6.4" stroke="${accent}" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
      ].join('');
    case 'cpu':
      return [
        `<rect x="4.2" y="4.2" width="7.6" height="7.6" rx="1.2" stroke="${accent}" stroke-width="1.35" fill="none"/>`,
        `<rect x="6.5" y="6.5" width="3" height="3" fill="${accent}"/>`,
        `<path d="M6.2 1.8v2.4M9.8 1.8v2.4M6.2 11.8v2.4M9.8 11.8v2.4M1.8 6.2h2.4M1.8 9.8h2.4M11.8 6.2h2.4M11.8 9.8h2.4" stroke="${accent}" stroke-width="1.25" stroke-linecap="round"/>`,
      ].join('');
    default:
      return `<circle cx="8" cy="8" r="4.5" stroke="${accent}" stroke-width="1.4" fill="none"/>`;
  }
}

export function renderCardSvg(project, themeName, config) {
  const t = config.theme[themeName];
  const accent = t.accents[project.accentKey] || t.accents.amber;
  const clipId = `clip-${escapeXml(project.id)}-${themeName}`;
  const lines = wrapText(project.description);
  const pills = computeCardPillLayouts(project.tags);

  const descSvg = lines
    .map((line, idx) => {
      const y = 66 + idx * 16;
      return `<text x="${CARD_LEFT}" y="${y}" font-family="${FONT_SANS}" font-size="11.3" font-weight="400" fill="${t.textMuted}">${escapeXml(line)}</text>`;
    })
    .join('\n  ');

  const pillsSvg = pills
    .map((pill) => {
      const textX = (pill.x + pill.width / 2).toFixed(1);
      const textY = pill.y + 14.5;
      return [
        `<rect x="${pill.x}" y="${pill.y}" width="${pill.width}" height="${pill.height}" rx="5" fill="${t.pillBg}" stroke="${t.border}" stroke-width="1"/>`,
        `<text x="${textX}" y="${textY}" text-anchor="middle" font-family="${FONT_MONO}" font-size="10.2" font-weight="500" fill="${t.pillText}">${escapeXml(pill.label)}</text>`,
      ].join('\n  ');
    })
    .join('\n  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" role="img" aria-label="${escapeXml(project.title)}">
  <defs>
    <clipPath id="${clipId}">
      <rect x="0.5" y="0.5" width="${CARD_WIDTH - 1}" height="${CARD_HEIGHT - 1}" rx="8"/>
    </clipPath>
  </defs>
  <rect x="0.5" y="0.5" width="${CARD_WIDTH - 1}" height="${CARD_HEIGHT - 1}" rx="8" fill="${t.surface}" stroke="${t.border}" stroke-width="1"/>
  <g clip-path="url(#${clipId})">
    <rect x="0" y="0" width="${CARD_WIDTH}" height="2.5" fill="${accent}"/>
  </g>
  <rect x="${CARD_LEFT}" y="16" width="28" height="28" rx="6" fill="${t.surfaceSubtle}" stroke="${t.border}" stroke-width="1"/>
  <g transform="translate(24, 22)">
    ${renderCardIcon(project.icon, accent)}
  </g>
  <text x="54" y="30" font-family="${FONT_SANS}" font-size="13.5" font-weight="600" fill="${t.textPrimary}">${escapeXml(project.title)}</text>
  <text x="54" y="44" font-family="${FONT_MONO}" font-size="10" font-weight="500" fill="${t.textSubtle}">${escapeXml(project.domain)}</text>
  <g transform="translate(390, 20)" opacity="0.85">
    <path d="M2.5 9.5 9.5 2.5M4.5 2.5h5v5" stroke="${t.textMuted}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </g>
  ${descSvg}
  ${pillsSvg}
  <line x1="${CARD_LEFT}" y1="144" x2="${CARD_RIGHT}" y2="144" stroke="${t.divider}" stroke-width="1"/>
  <circle cx="22" cy="158" r="3.5" fill="${accent}"/>
  <text x="31" y="161.5" font-family="${FONT_SANS}" font-size="11" font-weight="500" fill="${t.textSubtle}">${escapeXml(project.status)}</text>
  <text x="${CARD_RIGHT}" y="161.5" text-anchor="end" font-family="${FONT_MONO}" font-size="10.5" font-weight="600" fill="${t.textMuted}">${escapeXml(project.metric)}</text>
</svg>
`;
}

export function renderTechStackSvg(themeName, config) {
  const t = config.theme[themeName];
  const rowYs = [16, 58, 100];

  if (config.techStack.length > rowYs.length) {
    throw new Error(`techStack supports max ${rowYs.length} rows, got ${config.techStack.length}`);
  }

  const rowsSvg = config.techStack
    .map((group, rowIndex) => {
      const y = rowYs[rowIndex];
      const accent = t.accents[group.accentKey] || t.accents.amber;
      const dotY = y + 16;
      const labelY = y + 20;

      let cursorX = TECH_PILL_START_X;
      const pills = group.items.map((item) => {
        const width = Math.max(44, Math.round(item.length * 6.2) + 14);
        if (cursorX + width > TECH_PILL_RIGHT_MAX) {
          throw new Error(
            `Tech pill "${item}" in "${group.group}" overflows right bound (${cursorX + width} > ${TECH_PILL_RIGHT_MAX})`
          );
        }
        const pillX = cursorX;
        const pillY = y + 4;
        const textX = (pillX + width / 2).toFixed(1);
        const textY = pillY + 15.5;
        cursorX += width + 6;
        return [
          `<rect x="${pillX}" y="${pillY}" width="${width}" height="24" rx="5" fill="${t.surface}" stroke="${t.border}" stroke-width="1"/>`,
          `<text x="${textX}" y="${textY}" text-anchor="middle" font-family="${FONT_MONO}" font-size="10.4" font-weight="500" fill="${t.pillText}">${escapeXml(item)}</text>`,
        ].join('\n    ');
      });

      const divider =
        rowIndex < config.techStack.length - 1
          ? `<line x1="16" y1="${y + 37}" x2="${TECH_WIDTH - 16}" y2="${y + 37}" stroke="${t.divider}" stroke-width="1"/>`
          : '';

      return [
        `<circle cx="22" cy="${dotY}" r="3.5" fill="${accent}"/>`,
        `<text x="32" y="${labelY}" font-family="${FONT_MONO}" font-size="11.2" font-weight="600" fill="${t.textPrimary}">${escapeXml(group.group)}</text>`,
        pills.join('\n    '),
        divider,
      ]
        .filter(Boolean)
        .join('\n  ');
    })
    .join('\n  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${TECH_WIDTH}" height="${TECH_HEIGHT}" viewBox="0 0 ${TECH_WIDTH} ${TECH_HEIGHT}" role="img" aria-label="Tech Stack Matrix">
  <rect x="0.5" y="0.5" width="${TECH_WIDTH - 1}" height="${TECH_HEIGHT - 1}" rx="8" fill="${t.surfaceSubtle}" stroke="${t.border}" stroke-width="1"/>
  ${rowsSvg}
</svg>
`;
}

function splitTileSub(sub, maxLineChars = 20) {
  const text = String(sub).trim();
  const parts = text.split(' · ');
  if (text.length <= maxLineChars && parts.length < 4) {
    return [text, ''];
  }
  if (parts.length >= 2) {
    let bestIdx = 1;
    let bestScore = Infinity;
    for (let i = 1; i < parts.length; i++) {
      const left = parts.slice(0, i).join(' · ');
      const right = parts.slice(i).join(' · ');
      const maxLen = Math.max(left.length, right.length);
      const diff = Math.abs(left.length - right.length);
      const overflowPenalty = maxLen > maxLineChars ? 1000 : 0;
      const balanceTieBreak = left.length < right.length ? 0.5 : 0;
      const score = overflowPenalty + maxLen * 10 + diff + balanceTieBreak;
      if (score < bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    const line1 = parts.slice(0, bestIdx).join(' · ');
    const line2 = parts.slice(bestIdx).join(' · ');
    if (line1.length <= maxLineChars && line2.length <= maxLineChars) {
      return [line1, line2];
    }
  }
  const wrapped = wrapText(text, maxLineChars, 2);
  return [wrapped[0] || '', wrapped[1] || ''];
}

export function renderSnapshotSvg(themeName, config) {
  const t = config.theme[themeName];
  const snap = config.snapshot;
  const tileXs = [0.5, 142.5, 284.5];
  const tileW = 130;
  const tileH = 213;

  const tilesSvg = snap.tiles
    .map((tile, idx) => {
      const tx = tileXs[idx];
      const cx = (tx + tileW / 2).toFixed(1);
      const accent = t.accents[tile.accentKey] || t.accents.amber;
      const [sub1, sub2] = splitTileSub(tile.sub);

      if (tile.style === 'ring') {
        const radius = 34;
        const circ = 2 * Math.PI * radius;
        const progress = Math.max(0, Math.min(1, Number(tile.ringProgress ?? 0.84)));
        const offset = (circ * (1 - progress)).toFixed(2);
        const cy = 78;
        return [
          `<rect x="${tx}" y="0.5" width="${tileW}" height="${tileH}" rx="8" fill="${t.surface}" stroke="${t.border}" stroke-width="1"/>`,
          `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${t.divider}" stroke-width="6"/>`,
          `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${accent}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${offset}" transform="rotate(-90 ${cx} ${cy})"/>`,
          `<text x="${cx}" y="${cy + 7}" text-anchor="middle" font-family="${FONT_SANS}" font-size="20" font-weight="700" fill="${t.textPrimary}">${escapeXml(tile.value)}</text>`,
          `<text x="${cx}" y="138" text-anchor="middle" font-family="${FONT_SANS}" font-size="11.5" font-weight="600" fill="${t.textPrimary}">${escapeXml(tile.label)}</text>`,
          `<text x="${cx}" y="160" text-anchor="middle" font-family="${FONT_MONO}" font-size="9.5" fill="${t.textMuted}">${escapeXml(sub1)}</text>`,
          sub2
            ? `<text x="${cx}" y="175" text-anchor="middle" font-family="${FONT_MONO}" font-size="9.5" fill="${t.textMuted}">${escapeXml(sub2)}</text>`
            : '',
        ]
          .filter(Boolean)
          .join('\n  ');
      }

      return [
        `<rect x="${tx}" y="0.5" width="${tileW}" height="${tileH}" rx="8" fill="${t.surface}" stroke="${t.border}" stroke-width="1"/>`,
        `<circle cx="${cx}" cy="34" r="4" fill="${accent}"/>`,
        `<text x="${cx}" y="86" text-anchor="middle" font-family="${FONT_SANS}" font-size="32" font-weight="700" fill="${t.textPrimary}">${escapeXml(tile.value)}</text>`,
        `<text x="${cx}" y="120" text-anchor="middle" font-family="${FONT_SANS}" font-size="11.5" font-weight="600" fill="${t.textPrimary}">${escapeXml(tile.label)}</text>`,
        sub2
          ? `<text x="${cx}" y="142" text-anchor="middle" font-family="${FONT_MONO}" font-size="9.5" fill="${t.textMuted}">${escapeXml(sub1)}</text>`
          : `<text x="${cx}" y="144" text-anchor="middle" font-family="${FONT_MONO}" font-size="9.5" fill="${t.textMuted}">${escapeXml(sub1)}</text>`,
        sub2
          ? `<text x="${cx}" y="157" text-anchor="middle" font-family="${FONT_MONO}" font-size="9.5" fill="${t.textMuted}">${escapeXml(sub2)}</text>`
          : '',
      ]
        .filter(Boolean)
        .join('\n  ');
    })
    .join('\n  ');

  const panelX = 430.5;
  const panelW = 421;
  const barLeft = 448;
  const barWidth = 386;
  const barRight = barLeft + barWidth;
  const barYs = [52, 88, 124, 160];

  const barsSvg = snap.domainBars
    .map((bar, idx) => {
      const y = barYs[idx];
      const accent = t.accents[bar.accentKey] || t.accents.amber;
      const ratio = Math.max(0.05, Math.min(1, Number(bar.ratio)));
      const fillW = Math.round(barWidth * ratio);
      return [
        `<text x="${barLeft}" y="${y}" font-family="${FONT_SANS}" font-size="11.2" font-weight="600" fill="${t.textPrimary}">${escapeXml(bar.label)}</text>`,
        `<text x="${barRight}" y="${y}" text-anchor="end" font-family="${FONT_MONO}" font-size="10" fill="${t.textMuted}">${escapeXml(bar.metric)}</text>`,
        `<rect x="${barLeft}" y="${y + 7}" width="${barWidth}" height="6" rx="3" fill="${t.divider}"/>`,
        `<rect x="${barLeft}" y="${y + 7}" width="${fillW}" height="6" rx="3" fill="${accent}"/>`,
      ].join('\n  ');
    })
    .join('\n  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SNAPSHOT_WIDTH}" height="${SNAPSHOT_HEIGHT}" viewBox="0 0 ${SNAPSHOT_WIDTH} ${SNAPSHOT_HEIGHT}" role="img" aria-label="${escapeXml(snap.title)}">
  ${tilesSvg}
  <rect x="${panelX}" y="0.5" width="${panelW}" height="${tileH}" rx="8" fill="${t.surface}" stroke="${t.border}" stroke-width="1"/>
  <text x="${barLeft}" y="27" font-family="${FONT_SANS}" font-size="13" font-weight="600" fill="${t.textPrimary}">${escapeXml(snap.title)}</text>
  ${barsSvg}
  <text x="${barLeft}" y="198" font-family="${FONT_MONO}" font-size="9.8" fill="${t.textSubtle}">${escapeXml(snap.footnote)}</text>
</svg>
`;
}

export function renderReadmeMd(config) {
  const projectLinks = config.projects
    .map((p) => {
      const alt = escapeHtml(sanitizeAltText(`${p.title} - ${p.domain} (${p.metric})`));
      const url = escapeHtml(p.url);
      return [
        `  <a href="${url}">`,
        `    <img src="./assets/card-${escapeHtml(p.id)}-dark.svg#gh-dark-mode-only" alt="${alt}" width="49%">`,
        `    <img src="./assets/card-${escapeHtml(p.id)}-light.svg#gh-light-mode-only" alt="${alt}" width="49%">`,
        `  </a>`,
      ].join('\n');
    })
    .join('\n');

  const focusRows = config.focusAreas
    .map((f) => `| **${f.title}** | \`${f.stack}\` | ${f.detail} |`)
    .join('\n');

  const repoNotes = {
    'hand-gesture-smart-door-lock': {
      en: 'Edge AIoT access control extracting 97 wrist-normalized geometric features from 21 hand landmarks, 5-fold KNN/SVM classification, 3-step password FSM, SG90 GPIO18 PWM lock, and Telegram alerts (26 tests).',
      vi: 'Hệ thống khóa cửa thông minh trích xuất 97 đặc trưng hình học từ 21 điểm mốc bàn tay, phân loại KNN/SVM, máy trạng thái 3 bước, xung PWM SG90 trên GPIO18 và cảnh báo Telegram (26 kiểm thử).',
    },
    'amr-android-controller': {
      en: 'Native Kotlin & Jetpack Compose 3-screen mobile controller for Differential-Drive AMR over REST/MJPEG with an 8-zone <40 cm LiDAR active safety interlock and telemetry watchdog (51 JUnit4 + 21 Python tests).',
      vi: 'Ứng dụng Android Kotlin và Jetpack Compose 3 màn hình điều khiển AMR vi sai 2 bánh qua REST và MJPEG, tích hợp khóa an toàn LiDAR 8 vùng dưới 40 cm và giám sát kết nối (51 JUnit4 và 21 kiểm thử Python).',
    },
    'amr-cockpit-simulator': {
      en: 'Zero-dependency HTML5/ESM AMR cockpit and 2D physics/SLAM simulator with raycasted 8-zone LiDAR, 0.05 m occupancy grid, 640x480 tactical HUD, and automatic <0.40 m obstacle halt (30 Node tests).',
      vi: 'Trình mô phỏng buồng lái và vật lý AMR thuần HTML5/ESM không thư viện ngoài, mô phỏng quét LiDAR 2D 8 vùng, bản đồ SLAM 0.05 m/ô và cơ chế tự dừng khi vật cản dưới 0.40 m (30 kiểm thử Node).',
    },
    'cli-anything-amr': {
      en: 'Agent-native Python Click CLI and REPL harness exposing 10 command groups, 50-level undo/redo, dual differential kinematics profiles, safety interlock checks, and PGM map export (83 Python tests).',
      vi: 'Giao diện dòng lệnh Python Click và REPL chuẩn agent-native với 10 nhóm lệnh, hoàn tác 50 bước, tính toán động học vi sai, kiểm tra khóa an toàn và xuất bản đồ định dạng PGM (83 kiểm thử Python).',
    },
    'hybrid-yolov8-hsv-red-apple-detection': {
      en: '4-layer coarse-to-fine detector combining YOLOv8n, CLAHE-V contrast normalization, adaptive split-range HSV, geometric filtering, and NMS fusion achieving mAP@0.5 0.9512 (42 Python tests).',
      vi: 'Hệ thống nhận diện táo đỏ 4 tầng kết hợp YOLOv8n, cân bằng sáng CLAHE kênh V, lọc màu HSV hai dải thích ứng, lọc hình học và NMS đạt mAP@0.5 0.9512 (42 kiểm thử Python).',
    },
    'planar-arm-2dof-discrete-pid': {
      en: 'Dual LabVIEW 22.3.7 FINAL2.vi and bit-exact Python/NumPy discrete-time dual-joint PID controller with 2-DOF planar forward kinematics reaching 30.0123 deg and (6.83, 6.83) XY (43 Python tests).',
      vi: 'Bộ điều khiển PID rời rạc hai khớp và động học thuận cánh tay phẳng 2 bậc tự do triển khai song song trên LabVIEW 22.3.7 và Python/NumPy đạt 30.0123 độ tại tọa độ (6.83, 6.83) (43 kiểm thử Python).',
    },
    'warehouse-robot-fleet-telemetry': {
      en: 'MySQL 8.0 and SQLite 3NF fleet database with DENSE_RANK analytics over 1,000 route rows, sanitized ESP32 DHT22/VL53L0X MQTT telemetry logger, and 6-tab Tkinter dashboard (19 Python tests).',
      vi: 'Nền tảng dữ liệu đội robot kho vận chuẩn 3NF trên MySQL và SQLite, phân tích xếp hạng DENSE_RANK trên 1.000 lộ trình, thu nhận MQTT từ ESP32 và giao diện Tkinter 6 thẻ (19 kiểm thử Python).',
    },
  };

  const repoSummaryRows = config.projects
    .map((p) => {
      const note = repoNotes[p.id] || { en: p.description, vi: p.description };
      return `| [${p.title}](${p.url}) | \`${p.domain}\` · \`${p.metric}\` | **EN:** ${note.en}<br>**VI:** ${note.vi} |`;
    })
    .join('\n');

  const techAlt = escapeHtml(
    sanitizeAltText('Tech Stack Matrix covering Applied AI, Robotics, Embedded, Computer Vision, and Software Engineering')
  );
  const snapAlt = escapeHtml(
    sanitizeAltText('Verified Engineering Snapshot of active repositories and test suites')
  );

  return `## Hi, I'm ${config.displayName}

**${config.headline}** — ${config.subheadline.charAt(0).toLowerCase()}${config.subheadline.slice(1)}

\`${config.location}\` · ${config.availabilityNote}

### Overview / Tổng quan

This GitHub profile presents an integrated engineering portfolio across **Applied AI**, **Software**, **Robotics**, **Embedded** systems, and **Computer Vision**. Every linked repository ships runnable source code, calibrated datasets, and automated offline verification covering 315 verified tests across 7 repositories.

Hồ sơ GitHub này giới thiệu danh mục dự án kỹ thuật trong các lĩnh vực **Applied AI**, **Software** (phần mềm), **Robotics**, **Embedded** (hệ thống nhúng) và **Computer Vision** (thị giác máy tính). Mỗi kho lưu trữ đều đi kèm mã nguồn chạy thực tế, bộ dữ liệu chuẩn hóa và quy trình kiểm thử tự động cho toàn bộ 7 dự án.

### Tech Stack / Công nghệ cốt lõi

<p align="left">
  <img src="./assets/tech-stack-dark.svg#gh-dark-mode-only" alt="${techAlt}" width="100%">
  <img src="./assets/tech-stack-light.svg#gh-light-mode-only" alt="${techAlt}" width="100%">
</p>

### Architecture & Featured Repositories / Kiến trúc & Dự án nổi bật

<p align="left">
${projectLinks}
</p>

| Repository / Dự án | Domain & Metric | Architecture Summary / Tóm tắt kiến trúc (EN / VI) |
|---|---|---|
${repoSummaryRows}

### Engineering Focus, Setup & Verification / Trọng tâm kỹ thuật, Cài đặt & Kiểm thử

| Domain | Core Stack | Focus |
|---|---|---|
${focusRows}

To regenerate the dual-theme SVG profile cards, update the preview page, and verify strict XML well-formedness, config sync, offline assets, and privacy rules locally using Node 24, run the build and verification commands from the repository root:

Hướng dẫn cài đặt và chạy kiểm thử xác minh cục bộ: sử dụng Node 24 tại thư mục gốc của kho lưu trữ để sinh lại toàn bộ thẻ SVG hai giao diện, cập nhật trang xem trước và kiểm tra tính hợp lệ XML, đồng bộ cấu hình cũng như quy tắc bảo mật:

\`\`\`bash
node scripts/build-cards.mjs
node scripts/verify-profile.mjs
\`\`\`

### Snapshot / Thống kê kỹ thuật

<p align="left">
  <img src="./assets/snapshot-dark.svg#gh-dark-mode-only" alt="${snapAlt}" width="100%">
  <img src="./assets/snapshot-light.svg#gh-light-mode-only" alt="${snapAlt}" width="100%">
</p>
`;
}

export function renderPreviewHtml(config) {
  const d = config.theme.dark;
  const l = config.theme.light;

  const cardsHtml = config.projects
    .map((p) => {
      const alt = escapeHtml(sanitizeAltText(`${p.title} - ${p.domain} (${p.metric})`));
      return `          <a class="project-card-link" href="${escapeHtml(p.url)}" target="_blank" rel="noreferrer">
            <img class="theme-img" src="./assets/card-${escapeHtml(p.id)}-dark.svg#gh-dark-mode-only" alt="${alt}">
            <img class="theme-img" src="./assets/card-${escapeHtml(p.id)}-light.svg#gh-light-mode-only" alt="${alt}">
          </a>`;
    })
    .join('\n');

  const projectDetailsHtml = config.projects
    .map((p) => {
      const tagsHtml = p.tags
        .map((tag) => `<span class="detail-tag">${escapeHtml(tag)}</span>`)
        .join('');
      return `          <article class="detail-card">
            <div class="detail-head">
              <div>
                <h4 class="detail-title">${escapeHtml(p.title)}</h4>
                <span class="detail-domain">${escapeHtml(p.domain)}</span>
              </div>
              <span class="detail-metric">${escapeHtml(p.metric)}</span>
            </div>
            <p class="detail-desc">${escapeHtml(p.description)}</p>
            <div class="detail-tags">${tagsHtml}</div>
            <div class="detail-foot">
              <span>${escapeHtml(p.status)}</span>
              <a href="${escapeHtml(p.url)}" target="_blank" rel="noreferrer">View Repository</a>
            </div>
          </article>`;
    })
    .join('\n');

  const focusHtml = config.focusAreas
    .map(
      (f) => `          <div class="focus-row">
            <div>
              <div class="focus-title">${escapeHtml(f.title)}</div>
              <div class="focus-stack">${escapeHtml(f.stack)}</div>
            </div>
            <div class="focus-detail">${escapeHtml(f.detail)}</div>
          </div>`
    )
    .join('\n');

  const techGroupsHtml = config.techStack
    .map((group) => {
      const pills = group.items
        .map((item) => `<span class="matrix-pill">${escapeHtml(item)}</span>`)
        .join('');
      return `          <div class="matrix-group">
            <h4 class="matrix-title">${escapeHtml(group.group)}</h4>
            <div class="matrix-pills">${pills}</div>
          </div>`;
    })
    .join('\n');

  const sidebarDomainsHtml = config.sidebarDomains
    .map((item) => `        <li><span class="meta-dot"></span><span>${escapeHtml(item)}</span></li>`)
    .join('\n');

  const statusDotsHtml = config.statusDots
    .map((color) => `<span class="signal-dot" style="background:${escapeHtml(color)};"></span>`)
    .join('');

  const techAlt = escapeHtml(
    sanitizeAltText('Tech Stack Matrix covering Applied AI, Robotics, Embedded, Computer Vision, and Software Engineering')
  );
  const snapAlt = escapeHtml(
    sanitizeAltText('Verified Engineering Snapshot of active repositories and test suites')
  );

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(config.username)} (${escapeHtml(config.displayName)}) — GitHub Profile Preview</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Ccircle cx='8' cy='8' r='6' fill='%23f59e0b'/%3E%3C/svg%3E">
  <style>
    :root {
      --bg: ${d.canvas};
      --header-bg: ${d.headerBg};
      --surface: ${d.surface};
      --surface-subtle: ${d.surfaceSubtle};
      --border: ${d.border};
      --divider: ${d.divider};
      --text: ${d.textPrimary};
      --muted: ${d.textMuted};
      --subtle: ${d.textSubtle};
      --link: ${d.link};
      --accent: ${d.accents.amber};
      --btn-bg: #21262d;
      --btn-border: #363b42;
    }
    html[data-theme="light"] {
      --bg: ${l.canvas};
      --header-bg: ${l.headerBg};
      --surface: ${l.surface};
      --surface-subtle: ${l.surfaceSubtle};
      --border: ${l.border};
      --divider: ${l.divider};
      --text: ${l.textPrimary};
      --muted: ${l.textMuted};
      --subtle: ${l.textSubtle};
      --link: ${l.link};
      --accent: ${l.accents.amber};
      --btn-bg: #f6f8fa;
      --btn-border: #d0d7de;
    }
    html[data-theme="dark"] img[src$="#gh-light-mode-only"] { display: none; }
    html[data-theme="light"] img[src$="#gh-dark-mode-only"] { display: none; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: ${FONT_SANS};
      line-height: 1.5;
    }
    .topbar {
      background: var(--header-bg);
      border-bottom: 1px solid var(--border);
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }
    .topbar-left {
      display: flex;
      align-items: center;
      gap: 16px;
      font-size: 14px;
      font-weight: 600;
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
    }
    .gh-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--accent);
      display: inline-block;
    }
    .nav-tabs {
      display: flex;
      gap: 6px;
    }
    .tab-btn {
      background: transparent;
      border: 0;
      border-bottom: 2px solid transparent;
      color: var(--muted);
      font-family: inherit;
      font-size: 13px;
      font-weight: 500;
      padding: 6px 10px;
      cursor: pointer;
    }
    .tab-btn:hover { color: var(--text); }
    .tab-btn.active {
      color: var(--text);
      font-weight: 600;
      border-bottom-color: #f78166;
    }
    .theme-btn {
      background: var(--btn-bg);
      color: var(--text);
      border: 1px solid var(--btn-border);
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    .container {
      max-width: 1200px;
      margin: 28px auto;
      padding: 0 24px 48px;
      display: grid;
      grid-template-columns: 296px minmax(0, 1fr);
      gap: 28px;
      align-items: start;
    }
    .sidebar {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .avatar {
      width: 260px;
      height: 260px;
      border-radius: 50%;
      border: 1px solid var(--border);
      background: radial-gradient(circle at 30% 30%, #1f2937, #0d1117 70%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 64px;
      font-weight: 700;
      letter-spacing: 2px;
      color: #f59e0b;
    }
    html[data-theme="light"] .avatar {
      background: radial-gradient(circle at 30% 30%, #f3f4f6, #e5e7eb 70%);
      color: #d97706;
    }
    .name { font-size: 24px; font-weight: 600; margin: 0; line-height: 1.25; }
    .handle { font-size: 18px; font-weight: 300; color: var(--muted); margin: 0; }
    .bio { font-size: 14px; margin: 2px 0; color: var(--text); }
    .meta-list {
      list-style: none;
      padding: 0;
      margin: 4px 0 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: 13px;
      color: var(--muted);
    }
    .meta-list li { display: flex; align-items: center; gap: 8px; }
    .meta-list a { color: var(--link); text-decoration: none; }
    .meta-list a:hover { text-decoration: underline; }
    .meta-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--accent);
      flex-shrink: 0;
    }
    .readme-box {
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface-subtle);
      padding: 24px 28px;
    }
    .readme-crumb {
      font-family: ${FONT_MONO};
      font-size: 12px;
      color: var(--muted);
      margin-bottom: 16px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--border);
    }
    .tabpanel[hidden] { display: none; }
    h2 { font-size: 22px; margin: 0 0 8px; font-weight: 600; }
    h3 {
      font-size: 16px;
      margin: 26px 0 12px;
      padding-bottom: 6px;
      border-bottom: 1px solid var(--border);
      font-weight: 600;
    }
    .subtitle { margin: 0 0 10px; font-size: 14.5px; color: var(--text); }
    .signal-line {
      margin: 0;
      font-size: 13px;
      color: var(--muted);
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .signal-dots { display: inline-flex; gap: 5px; align-items: center; }
    .signal-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
    .theme-img { width: 100%; height: auto; display: block; }
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    .project-card-link {
      display: block;
      text-decoration: none;
      transition: transform 140ms ease;
    }
    .project-card-link:hover { transform: translateY(-2px); }
    .focus-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .focus-row {
      display: grid;
      grid-template-columns: 250px minmax(0, 1fr);
      gap: 14px;
      padding: 12px 14px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--surface);
      font-size: 13px;
    }
    .focus-title { font-weight: 600; color: var(--text); }
    .focus-stack { font-family: ${FONT_MONO}; font-size: 11px; color: var(--muted); margin-top: 3px; }
    .focus-detail { color: var(--muted); }
    .detail-grid, .matrix-list {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    .matrix-list { grid-template-columns: 1fr; }
    .detail-card, .matrix-group {
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface);
      padding: 16px;
    }
    .detail-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    }
    .detail-title, .matrix-title { margin: 0; font-size: 14.5px; font-weight: 600; }
    .detail-domain { font-family: ${FONT_MONO}; font-size: 11px; color: var(--subtle); }
    .detail-metric {
      font-family: ${FONT_MONO};
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: var(--surface-subtle);
      white-space: nowrap;
    }
    .detail-desc { font-size: 12.5px; color: var(--muted); margin: 10px 0 12px; }
    .detail-tags, .matrix-pills { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
    .detail-tag, .matrix-pill {
      font-family: ${FONT_MONO};
      font-size: 11px;
      padding: 3px 8px;
      border: 1px solid var(--border);
      border-radius: 5px;
      background: var(--surface-subtle);
    }
    .detail-foot {
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px solid var(--divider);
      display: flex;
      justify-content: space-between;
      font-size: 11.5px;
      color: var(--subtle);
    }
    .detail-foot a { color: var(--link); text-decoration: none; }
    @media (max-width: 900px) {
      .container { grid-template-columns: 1fr; }
      .cards-grid, .detail-grid, .focus-row { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="topbar-left">
      <div class="brand">
        <span class="gh-dot"></span>
        <span>${escapeHtml(config.username)}</span>
      </div>
      <nav class="nav-tabs" role="tablist" aria-label="Profile views">
        <button class="tab-btn active" role="tab" type="button" data-tab="overview" aria-selected="true">Overview</button>
        <button class="tab-btn" role="tab" type="button" data-tab="projects" aria-selected="false">Projects</button>
        <button class="tab-btn" role="tab" type="button" data-tab="stack" aria-selected="false">Tech Matrix</button>
      </nav>
    </div>
    <button class="theme-btn" id="themeToggle" type="button" aria-pressed="false">Toggle Light / Dark</button>
  </header>

  <main class="container">
    <aside class="sidebar">
      <div class="avatar">${escapeHtml(config.initials)}</div>
      <div>
        <h1 class="name">${escapeHtml(config.displayName)}</h1>
        <p class="handle">${escapeHtml(config.username)}</p>
      </div>
      <p class="bio">${escapeHtml(config.bio)}</p>
      <ul class="meta-list">
        <li><span class="meta-dot"></span><span>${escapeHtml(config.location)}</span></li>
        <li><span class="meta-dot"></span><a href="${escapeHtml(config.githubUrl)}" target="_blank" rel="noreferrer">github.com/${escapeHtml(config.username)}</a></li>
${sidebarDomainsHtml}
      </ul>
    </aside>

    <section class="readme-box">
      <div class="tabpanel" data-tabpanel="overview" role="tabpanel">
        <div class="readme-crumb">${escapeHtml(config.username)} / README.md</div>
        <h2>Hi, I'm ${escapeHtml(config.displayName)}</h2>
        <p class="subtitle"><strong>${escapeHtml(config.headline)}</strong> — ${escapeHtml(config.subheadline.charAt(0).toLowerCase() + config.subheadline.slice(1))}</p>
        <p class="signal-line">
          <span class="signal-dots">${statusDotsHtml}</span>
          <span>${escapeHtml(config.location)} · ${escapeHtml(config.availabilityNote)}</span>
        </p>

        <h3>Tech Stack</h3>
        <div>
          <img class="theme-img" src="./assets/tech-stack-dark.svg#gh-dark-mode-only" alt="${techAlt}">
          <img class="theme-img" src="./assets/tech-stack-light.svg#gh-light-mode-only" alt="${techAlt}">
        </div>

        <h3>Featured Projects</h3>
        <div class="cards-grid">
${cardsHtml}
        </div>

        <h3>Engineering Focus</h3>
        <div class="focus-list">
${focusHtml}
        </div>

        <h3>Software &amp; AI Snapshot</h3>
        <div>
          <img class="theme-img" src="./assets/snapshot-dark.svg#gh-dark-mode-only" alt="${snapAlt}">
          <img class="theme-img" src="./assets/snapshot-light.svg#gh-light-mode-only" alt="${snapAlt}">
        </div>
      </div>

      <div class="tabpanel" data-tabpanel="projects" role="tabpanel" hidden>
        <div class="readme-crumb">${escapeHtml(config.username)} / repositories</div>
        <h2>Featured Projects</h2>
        <p class="subtitle">Verified active builds across Applied AI, robotics, embedded systems, computer vision, and software engineering.</p>
        <div class="detail-grid">
${projectDetailsHtml}
        </div>
      </div>

      <div class="tabpanel" data-tabpanel="stack" role="tabpanel" hidden>
        <div class="readme-crumb">${escapeHtml(config.username)} / tech-matrix</div>
        <h2>Tech Stack &amp; Focus Areas</h2>
        <p class="subtitle">Strictly grounded Applied AI, robotics, embedded, computer vision, and software technologies verified across local repositories.</p>
        <div class="matrix-list">
${techGroupsHtml}
        </div>
        <h3>Engineering Focus</h3>
        <div class="focus-list">
${focusHtml}
        </div>
      </div>
    </section>
  </main>

  <script>
    (function () {
      const root = document.documentElement;
      const themeBtn = document.getElementById('themeToggle');
      const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
      const panels = Array.from(document.querySelectorAll('[data-tabpanel]'));

      themeBtn.addEventListener('click', () => {
        const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', next);
        themeBtn.setAttribute('aria-pressed', String(next === 'light'));
      });

      tabs.forEach((btn) => {
        btn.addEventListener('click', () => {
          const target = btn.getAttribute('data-tab');
          tabs.forEach((t) => {
            const active = t === btn;
            t.classList.toggle('active', active);
            t.setAttribute('aria-selected', String(active));
          });
          panels.forEach((panel) => {
            panel.hidden = panel.getAttribute('data-tabpanel') !== target;
          });
        });
      });
    })();
  </script>
</body>
</html>
`;
}

export function validateConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('Invalid profile.config.json object.');
  }
  if (!config.bio || config.bio.length > 160) {
    throw new Error(`bio length must be 1..160 chars, got ${config.bio?.length ?? 0}`);
  }
  if (!Array.isArray(config.projects) || config.projects.length < 4 || config.projects.length > 8) {
    throw new Error(`projects length must be 4..8, got ${config.projects?.length ?? 0}`);
  }
}

export function generateArtifacts(config) {
  validateConfig(config);
  const assets = new Map();

  for (const project of config.projects) {
    for (const themeName of ['dark', 'light']) {
      assets.set(`card-${project.id}-${themeName}.svg`, renderCardSvg(project, themeName, config));
    }
  }
  for (const themeName of ['dark', 'light']) {
    assets.set(`tech-stack-${themeName}.svg`, renderTechStackSvg(themeName, config));
    assets.set(`snapshot-${themeName}.svg`, renderSnapshotSvg(themeName, config));
  }

  return {
    assets,
    readme: renderReadmeMd(config),
    preview: renderPreviewHtml(config),
  };
}

function main() {
  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  const { assets, readme, preview } = generateArtifacts(config);

  mkdirSync(ASSETS_DIR, { recursive: true });
  for (const entry of readdirSync(ASSETS_DIR)) {
    if (entry.endsWith('.svg') && !assets.has(entry)) {
      unlinkSync(join(ASSETS_DIR, entry));
    }
  }

  const generated = [];
  for (const [fileName, content] of assets.entries()) {
    const outPath = join(ASSETS_DIR, fileName);
    writeFileSync(outPath, content, 'utf8');
    generated.push(outPath);
  }

  const readmePath = join(ROOT_DIR, 'README.md');
  writeFileSync(readmePath, readme, 'utf8');
  generated.push(readmePath);

  const previewPath = join(ROOT_DIR, 'preview.html');
  writeFileSync(previewPath, preview, 'utf8');
  generated.push(previewPath);

  console.log(`Generated ${generated.length} deterministic profile artifacts.`);
}

if (process.argv[1] && resolve(process.argv[1]) === __filename) {
  main();
}
