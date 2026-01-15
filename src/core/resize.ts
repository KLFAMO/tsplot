export function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1;

  const rect = canvas.getBoundingClientRect();
  const displayWidth = Math.max(1, Math.round(rect.width));
  const displayHeight = Math.max(1, Math.round(rect.height));

  const neededWidth = Math.round(displayWidth * dpr);
  const neededHeight = Math.round(displayHeight * dpr);

  const changed = canvas.width !== neededWidth || canvas.height !== neededHeight;
  if (changed) {
    canvas.width = neededWidth;
    canvas.height = neededHeight;
  }

  return { changed, dpr, displayWidth, displayHeight };
}
