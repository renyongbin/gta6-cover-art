// Fixed scenes for screenshots: ?shot=editor shows the editor with sample photos
// loaded, panels and controls visible; ?shot=cover shows the cover alone, fitted
// to the viewport. `layout`, `theme`, `size`, `title`, `subtitle`, `footer` and
// `photos` (comma-separated sample names, one per panel, in order) pick the scene.
// window.__shotReady is set once the cover has been painted.
export async function runShot(shot, query, setup) {
  const isCover = shot === 'cover';
  if (isCover) document.body.classList.add('shot-cover');
  const patch = {
    layout: query.get('layout') ?? 'trio',
    theme: query.get('theme') ?? 'sunset',
    size: query.get('size') ?? '1920x1080',
    title: query.get('title') ?? 'VICE CITY',
    subtitle: query.get('subtitle') ?? 'SUNSET HEIST',
    footer: query.get('footer') ?? 'A LEONIDA STORY',
    photos: (query.get('photos') ?? 'pier,boulevard').split(',').map((s) => s.trim()).filter(Boolean),
  };
  await setup(patch);
  if (isCover) {
    // Fit the canvas into the viewport without distorting it, edge to edge.
    const canvas = document.getElementById('cover');
    const scale = Math.min(window.innerWidth / canvas.width, window.innerHeight / canvas.height);
    canvas.style.width = `${Math.round(canvas.width * scale)}px`;
    canvas.style.height = `${Math.round(canvas.height * scale)}px`;
  }
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
