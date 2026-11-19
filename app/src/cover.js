// Vice City Cover Studio — the cover renderer. Draws the multi-panel poster onto a
// canvas: each panel holds one photo (cover-fit, per-panel zoom and pan), a sunset /
// neon colour grade over the photos, paper-white gutters between the panels, and the
// big stacked title, tagline and footer across the foot of the cover. No Rockstar
// artwork, logo or font is used anywhere: the lettering is plain system sans-serif
// (Arial Black weight) drawn by this file, and every photo is drawn from a file
// under app/ or one the person loaded from their own machine.

/** Panel layouts, as fractions of the cover. `panels` are x/y/w/h rectangles. */
export const LAYOUTS = {
  hero: {
    label: 'Hero',
    panels: [{ x: 0, y: 0, w: 1, h: 1 }],
  },
  splitX: {
    label: 'Split L/R',
    panels: [
      { x: 0, y: 0, w: 0.5, h: 1 },
      { x: 0.5, y: 0, w: 0.5, h: 1 },
    ],
  },
  splitY: {
    label: 'Split T/B',
    panels: [
      { x: 0, y: 0, w: 1, h: 0.5 },
      { x: 0, y: 0.5, w: 1, h: 0.5 },
    ],
  },
  grid: {
    label: 'Grid 2×2',
    panels: [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
  trio: {
    label: 'Trio',
    panels: [
      { x: 0, y: 0, w: 0.62, h: 1 },
      { x: 0.62, y: 0, w: 0.38, h: 0.5 },
      { x: 0.62, y: 0.5, w: 0.38, h: 0.5 },
    ],
  },
};

/** Colour grades. `sky` tints the photos, `accent` draws the rules and chips. */
export const THEMES = {
  sunset: {
    name: 'Sunset',
    sky: ['#ff9a3d', '#ff2e63', '#7b2ff7'],
    accent: '#ffd319',
    ink: '#1b1035',
    titleTop: '#ffffff',
    titleBottom: '#ffd319',
    scrim: '27, 16, 53',
  },
  neon: {
    name: 'Neon',
    sky: ['#00f0ff', '#7b2ff7', '#ff00a8'],
    accent: '#00f0ff',
    ink: '#0b1035',
    titleTop: '#eafcff',
    titleBottom: '#00f0ff',
    scrim: '8, 8, 32',
  },
  gold: {
    name: 'Black Gold',
    sky: ['#f5e6a8', '#d4af37', '#141414'],
    accent: '#d4af37',
    ink: '#0a0a0a',
    titleTop: '#fff6d8',
    titleBottom: '#d4af37',
    scrim: '0, 0, 0',
  },
};

/** Export sizes offered by the editor, in pixels. */
export const SIZES = ['1080x1080', '1080x1350', '1920x1080', '1080x1920'];

/** Pixel rectangles for a layout on a cover of W by H. */
export function layoutPanels(layout, W, H) {
  const def = LAYOUTS[layout] ?? LAYOUTS.trio;
  return def.panels.map((p) => ({
    x: p.x * W,
    y: p.y * H,
    w: p.w * W,
    h: p.h * H,
  }));
}

/** Which panel (index, or -1) holds the point px, py on a W by H cover. */
export function panelAt(layout, W, H, px, py) {
  const rects = layoutPanels(layout, W, H);
  for (let i = 0; i < rects.length; i += 1) {
    const r = rects[i];
    if (px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) return i;
  }
  return -1;
}

/** A panel's photo slot: { photo: index into state.photos or -1, zoom, cx, cy }. */
export function blankPanel() {
  return { photo: -1, zoom: 1, cx: 0, cy: 0 };
}

function fitText(ctx, text, maxWidth, startSize, minSize) {
  let size = startSize;
  ctx.font = `900 ${size}px "Arial Black", Arial, sans-serif`;
  while (size > minSize && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `900 ${size}px "Arial Black", Arial, sans-serif`;
  }
  return size;
}

function wrapTitleLines(ctx, text, maxWidth, size) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [text];
  ctx.font = `900 ${size}px "Arial Black", Arial, sans-serif`;
  if (ctx.measureText(text).width <= maxWidth) return [text];
  // Greedy wrap into at most two lines, split near the middle word.
  let best = null;
  for (let cut = 1; cut < words.length; cut += 1) {
    const a = words.slice(0, cut).join(' ');
    const b = words.slice(cut).join(' ');
    const w = Math.max(ctx.measureText(a).width, ctx.measureText(b).width);
    if (!best || w < best.w) best = { lines: [a, b], w };
  }
  return best.lines;
}

function drawPhotoInto(ctx, img, rect, slot, theme) {
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (img) {
    const base = Math.max(w / img.naturalWidth, h / img.naturalHeight) * slot.zoom;
    const dw = img.naturalWidth * base;
    const dh = img.naturalHeight * base;
    const dx = x + (w - dw) / 2 + slot.cx * w;
    const dy = y + (h - dh) / 2 + slot.cy * h;
    ctx.drawImage(img, dx, dy, dw, dh);
    // Sunset / neon grade: a soft vertical wash of the theme colours.
    const grade = ctx.createLinearGradient(x, y, x, y + h);
    grade.addColorStop(0, theme.sky[0]);
    grade.addColorStop(0.55, theme.sky[1]);
    grade.addColorStop(1, theme.sky[2]);
    ctx.globalAlpha = 0.22;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = grade;
    ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    // Vignette so the panel edges read as one poster.
    const vig = ctx.createRadialGradient(
      x + w / 2, y + h / 2, Math.min(w, h) * 0.35,
      x + w / 2, y + h / 2, Math.max(w, h) * 0.75,
    );
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = vig;
    ctx.fillRect(x, y, w, h);
  } else {
    const empty = ctx.createLinearGradient(x, y, x + w, y + h);
    empty.addColorStop(0, theme.sky[0]);
    empty.addColorStop(1, theme.sky[2]);
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = empty;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = Math.max(2, w * 0.004);
    ctx.setLineDash([w * 0.02, w * 0.015]);
    ctx.strokeRect(x + w * 0.06, y + h * 0.06, w * 0.88, h * 0.88);
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const plus = fitText(ctx, '+', w * 0.7, h * 0.22, 12);
    ctx.font = `900 ${plus}px "Arial Black", Arial, sans-serif`;
    ctx.fillText('+', x + w / 2, y + h * 0.42);
    const label = fitText(ctx, 'ADD A PHOTO', w * 0.7, h * 0.055, 10);
    ctx.font = `900 ${label}px "Arial Black", Arial, sans-serif`;
    ctx.fillText('ADD A PHOTO', x + w / 2, y + h * 0.66);
  }
  ctx.restore();
}

function drawTitleBlock(ctx, state, theme, W, H) {
  const bandTop = H * 0.68;
  const scrim = ctx.createLinearGradient(0, bandTop - H * 0.06, 0, H);
  scrim.addColorStop(0, `rgba(${theme.scrim},0)`);
  scrim.addColorStop(0.45, `rgba(${theme.scrim},0.62)`);
  scrim.addColorStop(1, `rgba(${theme.scrim},0.92)`);
  ctx.fillStyle = scrim;
  ctx.fillRect(0, bandTop - H * 0.06, W, H - bandTop + H * 0.06);

  const margin = W * 0.05;
  const maxText = W - margin * 2;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Tagline, with an accent rule above it.
  const tag = (state.subtitle || '').trim().toUpperCase();
  let cursorY = H * 0.815;
  if (tag) {
    const tagSize = fitText(ctx, tag, maxText, H * 0.038, 10);
    ctx.fillStyle = theme.accent;
    ctx.fillRect(margin, cursorY - tagSize * 1.9, W * 0.11, Math.max(3, H * 0.006));
    ctx.font = `900 ${tagSize}px "Arial Black", Arial, sans-serif`;
    try { ctx.letterSpacing = `${Math.round(tagSize * 0.18)}px`; } catch { /* older canvas */ }
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = tagSize * 0.3;
    ctx.fillText(tag, margin, cursorY);
    ctx.shadowBlur = 0;
    try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
    cursorY += H * 0.012;
  }

  // Big title, slightly sheared and tilted, dark outline + bright gradient fill.
  const title = (state.title || '').trim().toUpperCase() || 'VICE CITY';
  let titleSize = H * 0.115;
  let lines = wrapTitleLines(ctx, title, maxText, titleSize);
  while (lines.length > 1 && titleSize > H * 0.06) {
    titleSize -= 4;
    lines = wrapTitleLines(ctx, title, maxText, titleSize);
  }
  if (lines.length === 1) {
    titleSize = fitText(ctx, title, maxText, titleSize, H * 0.045);
    lines = [title];
  }
  const lineHeight = titleSize * 0.98;
  // Anchor the block so its last baseline sits just above the footer.
  const footerH = H * 0.045;
  const baseY = H - footerH - H * 0.012;
  const titleY = baseY - (lines.length - 1) * lineHeight;
  ctx.save();
  ctx.translate(margin, titleY);
  ctx.transform(1, 0, -0.1, 1, 0, 0);
  ctx.rotate(-0.015);
  const fill = ctx.createLinearGradient(0, -titleSize, 0, lineHeight * (lines.length - 1) + titleSize * 0.1);
  fill.addColorStop(0, theme.titleTop);
  fill.addColorStop(1, theme.titleBottom);
  lines.forEach((line, i) => {
    const ly = i * lineHeight;
    ctx.font = `900 ${titleSize}px "Arial Black", Arial, sans-serif`;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = theme.ink;
    ctx.lineWidth = Math.max(3, titleSize * 0.16);
    ctx.strokeText(line, 0, ly);
    ctx.fillStyle = fill;
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = titleSize * 0.12;
    ctx.shadowOffsetY = titleSize * 0.05;
    ctx.fillText(line, 0, ly);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  });
  ctx.restore();

  // Footer line, small caps across the foot.
  const foot = (state.footer || '').trim().toUpperCase();
  if (foot) {
    const footSize = fitText(ctx, foot, maxText, H * 0.021, 9);
    ctx.font = `700 ${footSize}px Arial, sans-serif`;
    try { ctx.letterSpacing = `${Math.round(footSize * 0.3)}px`; } catch { /* older canvas */ }
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.textAlign = 'center';
    ctx.fillText(foot, W / 2, H - H * 0.014);
    try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
    ctx.textAlign = 'left';
  }
}

/**
 * Draws the whole cover. `state` is { layout, theme, title, subtitle, footer,
 * photos: [{ img }], panels: [{ photo, zoom, cx, cy }] }. `opts.selected` is the
 * panel index to outline for the editor (or -1); `opts.chrome` draws that outline.
 */
export function drawCover(canvas, state, opts = {}) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const theme = THEMES[state.theme] ?? THEMES.sunset;
  const gap = Math.max(2, Math.round(Math.min(W, H) * 0.007));

  // Paper-white gutters between the panels, like a printed poster collage.
  ctx.fillStyle = '#f5efe6';
  ctx.fillRect(0, 0, W, H);

  const rects = layoutPanels(state.layout, W, H);
  rects.forEach((r, i) => {
    const inset = {
      x: r.x + (r.x > 0 ? gap / 2 : 0),
      y: r.y + (r.y > 0 ? gap / 2 : 0),
      w: r.w - (r.x > 0 ? gap / 2 : 0) - (r.x + r.w < W ? gap / 2 : 0),
      h: r.h - (r.y > 0 ? gap / 2 : 0) - (r.y + r.h < H ? gap / 2 : 0),
    };
    const slot = state.panels[i] ?? blankPanel();
    const img = slot.photo >= 0 && state.photos[slot.photo] ? state.photos[slot.photo].img : null;
    drawPhotoInto(ctx, img, inset, slot, theme);
  });

  drawTitleBlock(ctx, state, theme, W, H);

  if (opts.chrome && opts.selected >= 0 && rects[opts.selected]) {
    const r = rects[opts.selected];
    ctx.save();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = Math.max(3, W * 0.004);
    ctx.setLineDash([Math.max(8, W * 0.012), Math.max(6, W * 0.008)]);
    ctx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
    ctx.setLineDash([]);
    const tag = `PANEL ${opts.selected + 1}`;
    const tagSize = Math.max(13, H * 0.02);
    ctx.font = `800 ${tagSize}px Arial, sans-serif`;
    const tw = ctx.measureText(tag).width + tagSize * 1.2;
    ctx.fillStyle = theme.accent;
    ctx.fillRect(r.x + 2, r.y + 2, tw, tagSize * 1.9);
    ctx.fillStyle = theme.ink;
    ctx.textBaseline = 'middle';
    ctx.fillText(tag, r.x + 2 + tagSize * 0.6, r.y + 2 + tagSize * 0.95);
    ctx.restore();
  }
}
