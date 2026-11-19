// Vice City Cover Studio — wires the editor: photos in (file picker, drag and drop,
// two samples), layout and colour-grade switching, caption editing, per-panel crop
// (click a panel to select it, drag to pan, scroll to zoom, or use the sliders),
// and PNG export in the four post sizes. A `?shot=` query sets up a fixed scene
// for a screenshot instead (./shots.js). Photos are read on this machine only and
// are never uploaded anywhere.
import { drawCover, layoutPanels, panelAt, blankPanel, LAYOUTS, THEMES } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const status = document.getElementById('status');
const tray = document.getElementById('tray');
const titleInput = document.getElementById('title');
const subtitleInput = document.getElementById('subtitle');
const footerInput = document.getElementById('footer');
const sizeSelect = document.getElementById('size');
const panelPhotoSelect = document.getElementById('panel-photo');
const zoomInput = document.getElementById('zoom');
const zoomVal = document.getElementById('zoom-val');
const panXInput = document.getElementById('pan-x');
const panYInput = document.getElementById('pan-y');
const panelName = document.getElementById('panel-name');

const SIZES = {
  '1080x1080': [1080, 1080],
  '1080x1350': [1080, 1350],
  '1920x1080': [1920, 1080],
  '1080x1920': [1080, 1920],
};

const state = {
  layout: 'trio',
  theme: 'sunset',
  title: 'VICE CITY',
  subtitle: 'SUNSET HEIST',
  footer: 'A LEONIDA STORY',
  size: '1920x1080',
  photos: [], // { name, img, url }
  panels: [blankPanel(), blankPanel(), blankPanel()],
  selectedPhoto: 0,
  selectedPanel: 0,
};

function panelCount() {
  return (LAYOUTS[state.layout] ?? LAYOUTS.trio).panels.length;
}

function syncPanels() {
  while (state.panels.length < panelCount()) state.panels.push(blankPanel());
  state.panels.length = panelCount();
  if (state.selectedPanel >= panelCount()) state.selectedPanel = 0;
}

function redraw(chrome = true) {
  syncPanels();
  drawCover(canvas, state, { selected: chrome ? state.selectedPanel : -1, chrome });
}

function setStatus(text) {
  status.textContent = text;
}

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function addPhoto(name, url, { assign = true } = {}) {
  // The same sample twice is still one photo: reuse it, so the tray never
  // fills with duplicates of one file.
  let index = state.photos.findIndex((p) => p.url === url);
  if (index < 0) {
    const img = await loadImage(url);
    index = state.photos.length;
    state.photos.push({ name, img, url });
  }
  state.selectedPhoto = index;
  if (assign) {
    syncPanels();
    const empty = state.panels.findIndex((p) => p.photo < 0);
    const target = empty >= 0 ? empty : state.selectedPanel;
    state.panels[target] = { photo: index, zoom: 1, cx: 0, cy: 0 };
    state.selectedPanel = target;
  }
  renderTray();
  redraw();
  return index;
}

function renderTray() {
  tray.innerHTML = '';
  if (state.photos.length === 0) {
    const p = document.createElement('p');
    p.className = 'tray-empty';
    p.textContent = 'No photos yet — add one, or load a sample.';
    tray.append(p);
    return;
  }
  state.photos.forEach((photo, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `thumb${i === state.selectedPhoto ? ' selected' : ''}`;
    btn.title = photo.name;
    btn.setAttribute('aria-label', `Use photo ${photo.name}`);
    const img = document.createElement('img');
    img.src = photo.url;
    img.alt = photo.name;
    btn.append(img);
    const rm = document.createElement('span');
    rm.className = 'rm';
    rm.textContent = '×';
    rm.title = 'Remove this photo';
    rm.addEventListener('click', (e) => {
      e.stopPropagation();
      removePhoto(i);
    });
    btn.append(rm);
    btn.addEventListener('click', () => {
      state.selectedPhoto = i;
      renderTray();
    });
    tray.append(btn);
  });
}

function removePhoto(index) {
  const [gone] = state.photos.splice(index, 1);
  if (gone && gone.url.startsWith('blob:')) URL.revokeObjectURL(gone.url);
  state.panels.forEach((p) => {
    if (p.photo === index) p.photo = -1;
    else if (p.photo > index) p.photo -= 1;
  });
  if (state.selectedPhoto >= state.photos.length) state.selectedPhoto = Math.max(0, state.photos.length - 1);
  renderTray();
  redraw();
}

function renderLayoutButtons() {
  const box = document.getElementById('layouts');
  box.innerHTML = '';
  const diagrams = {
    hero: 'diagram-hero',
    splitX: 'diagram-split-x',
    splitY: 'diagram-split-y',
    grid: 'diagram-grid',
    trio: 'diagram-trio',
  };
  Object.entries(LAYOUTS).forEach(([key, def]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `layout-btn${key === state.layout ? ' selected' : ''}`;
    btn.setAttribute('aria-pressed', String(key === state.layout));
    const diagram = document.createElement('span');
    diagram.className = `layout-diagram ${diagrams[key]}`;
    diagram.setAttribute('aria-hidden', 'true');
    def.panels.forEach(() => diagram.append(document.createElement('i')));
    btn.append(diagram);
    btn.append(document.createTextNode(def.label));
    btn.addEventListener('click', () => {
      state.layout = key;
      renderLayoutButtons();
      renderPanelCard();
      redraw();
    });
    box.append(btn);
  });
}

function renderThemeButtons() {
  const box = document.getElementById('themes');
  box.innerHTML = '';
  Object.entries(THEMES).forEach(([key, theme]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `theme-btn${key === state.theme ? ' selected' : ''}`;
    btn.setAttribute('aria-pressed', String(key === state.theme));
    const chip = document.createElement('span');
    chip.className = `theme-chip theme-${key}`;
    chip.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.textContent = theme.name;
    btn.append(chip, label);
    btn.addEventListener('click', () => {
      state.theme = key;
      renderThemeButtons();
      redraw();
    });
    box.append(btn);
  });
}

function renderPanelCard() {
  syncPanels();
  const slot = state.panels[state.selectedPanel];
  const photo = slot.photo >= 0 ? state.photos[slot.photo] : null;
  panelName.textContent = `Panel ${state.selectedPanel + 1} of ${panelCount()} — ${photo ? photo.name : 'empty'}`;
  panelPhotoSelect.innerHTML = '';
  const none = document.createElement('option');
  none.value = '-1';
  none.textContent = 'Empty panel';
  panelPhotoSelect.append(none);
  state.photos.forEach((p, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = p.name;
    panelPhotoSelect.append(opt);
  });
  panelPhotoSelect.value = String(slot.photo);
  zoomInput.value = String(slot.zoom);
  zoomVal.textContent = `${slot.zoom.toFixed(2)}×`;
  panXInput.value = String(slot.cx);
  panYInput.value = String(slot.cy);
}

function applySize() {
  const [w, h] = SIZES[state.size] ?? SIZES['1920x1080'];
  canvas.width = w;
  canvas.height = h;
  redraw();
}

// --- events: caption, size, export -----------------------------------------
titleInput.addEventListener('input', () => { state.title = titleInput.value; redraw(); });
subtitleInput.addEventListener('input', () => { state.subtitle = subtitleInput.value; redraw(); });
footerInput.addEventListener('input', () => { state.footer = footerInput.value; redraw(); });
sizeSelect.addEventListener('change', () => {
  state.size = sizeSelect.value;
  applySize();
  setStatus(`Preview is now ${state.size.replace('x', ' × ')}.`);
});
document.getElementById('export').addEventListener('click', () => {
  redraw(false);
  canvas.toBlob((blob) => {
    redraw();
    if (!blob) {
      setStatus('Export failed — please try again.');
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-city-cover-${state.size}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    setStatus(`Saved vice-city-cover-${state.size}.png — ${state.size.replace('x', ' × ')} pixels.`);
  }, 'image/png');
});

// --- events: photos ----------------------------------------------------------
document.getElementById('photo').addEventListener('change', async (e) => {
  const files = [...e.target.files];
  for (const file of files) {
    try {
      await addPhoto(file.name, URL.createObjectURL(file));
    } catch {
      setStatus(`Could not read ${file.name}.`);
    }
  }
  e.target.value = '';
  setStatus(files.length ? `${files.length} photo${files.length > 1 ? 's' : ''} added.` : '');
});
document.getElementById('sample-boulevard').addEventListener('click', async () => {
  await addPhoto('Boulevard · sunset drive', 'samples/boulevard.jpg');
  setStatus('Sample photo “Boulevard” added.');
});
document.getElementById('sample-pier').addEventListener('click', async () => {
  await addPhoto('Pier · fishing', 'samples/pier.jpg');
  setStatus('Sample photo “Pier” added.');
});

const dropzone = document.getElementById('dropzone');
['dragenter', 'dragover'].forEach((name) => dropzone.addEventListener(name, (e) => {
  e.preventDefault();
  dropzone.classList.add('drag-over');
}));
['dragleave', 'drop'].forEach((name) => dropzone.addEventListener(name, (e) => {
  e.preventDefault();
  dropzone.classList.remove('drag-over');
}));
dropzone.addEventListener('drop', async (e) => {
  const files = [...(e.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith('image/'));
  for (const file of files) {
    try {
      await addPhoto(file.name, URL.createObjectURL(file));
    } catch {
      setStatus(`Could not read ${file.name}.`);
    }
  }
  if (files.length) setStatus(`${files.length} photo${files.length > 1 ? 's' : ''} dropped in.`);
});

// --- events: panel selection, drag-to-pan, scroll-to-zoom --------------------
function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * canvas.width,
    y: ((e.clientY - rect.top) / rect.height) * canvas.height,
  };
}
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  const { x, y } = canvasPoint(e);
  const index = panelAt(state.layout, canvas.width, canvas.height, x, y);
  if (index < 0) return;
  state.selectedPanel = index;
  // Clicking a panel places the tray's selected photo in it.
  if (state.photos[state.selectedPhoto]) {
    state.panels[index].photo = state.selectedPhoto;
  }
  drag = { x, y, index };
  canvas.setPointerCapture(e.pointerId);
  renderPanelCard();
  redraw();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const { x, y } = canvasPoint(e);
  const rects = layoutPanels(state.layout, canvas.width, canvas.height);
  const r = rects[drag.index];
  const slot = state.panels[drag.index];
  if (!r || !slot || slot.photo < 0) return;
  slot.cx = Math.max(-0.5, Math.min(0.5, slot.cx + (x - drag.x) / r.w));
  slot.cy = Math.max(-0.5, Math.min(0.5, slot.cy + (y - drag.y) / r.h));
  drag = { x, y, index: drag.index };
  renderPanelCard();
  redraw();
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const { x, y } = canvasPoint(e);
  const index = panelAt(state.layout, canvas.width, canvas.height, x, y);
  if (index < 0) return;
  const slot = state.panels[index];
  if (!slot || slot.photo < 0) return;
  state.selectedPanel = index;
  slot.zoom = Math.max(1, Math.min(3, slot.zoom * Math.exp(-e.deltaY * 0.0012)));
  renderPanelCard();
  redraw();
}, { passive: false });

// --- events: selected-panel sliders -----------------------------------------
panelPhotoSelect.addEventListener('change', () => {
  const slot = state.panels[state.selectedPanel];
  slot.photo = Number(panelPhotoSelect.value);
  if (slot.photo >= 0) state.selectedPhoto = slot.photo;
  renderTray();
  renderPanelCard();
  redraw();
});
zoomInput.addEventListener('input', () => {
  state.panels[state.selectedPanel].zoom = Number(zoomInput.value);
  zoomVal.textContent = `${Number(zoomInput.value).toFixed(2)}×`;
  redraw();
});
panXInput.addEventListener('input', () => {
  state.panels[state.selectedPanel].cx = Number(panXInput.value);
  redraw();
});
panYInput.addEventListener('input', () => {
  state.panels[state.selectedPanel].cy = Number(panYInput.value);
  redraw();
});
document.getElementById('panel-reset').addEventListener('click', () => {
  state.panels[state.selectedPanel] = blankPanel();
  renderPanelCard();
  redraw();
});

// --- screenshot scenes -------------------------------------------------------
const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  runShot(shot, params, async (patch) => {
    state.layout = patch.layout;
    state.theme = patch.theme;
    state.title = patch.title;
    state.subtitle = patch.subtitle;
    state.footer = patch.footer;
    state.size = patch.size;
    titleInput.value = state.title;
    subtitleInput.value = state.subtitle;
    footerInput.value = state.footer;
    sizeSelect.value = state.size;
    canvas.width = (SIZES[state.size] ?? SIZES['1920x1080'])[0];
    canvas.height = (SIZES[state.size] ?? SIZES['1920x1080'])[1];
    state.photos = [];
    state.panels = [];
    for (const name of patch.photos) {
      await addPhoto(name === 'pier' ? 'Pier · fishing' : 'Boulevard · sunset drive', `samples/${name}.jpg`, { assign: true });
    }
    renderLayoutButtons();
    renderThemeButtons();
    renderPanelCard();
    // Cover scenes are the exported art: no editor outline on them.
    redraw(shot === 'editor');
  });
} else {
  renderLayoutButtons();
  renderThemeButtons();
  renderPanelCard();
  renderTray();
  applySize();
  // Start with both samples loaded, so the first thing the person sees is a
  // finished-looking cover, not an empty page.
  addPhoto('Pier · fishing', 'samples/pier.jpg').then(() => addPhoto('Boulevard · sunset drive', 'samples/boulevard.jpg'));
}
