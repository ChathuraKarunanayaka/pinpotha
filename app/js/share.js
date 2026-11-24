// Handing a finished file (card, PDF, collage) to WhatsApp.
export const canShareFiles = file => !!(navigator.canShare && navigator.canShare({ files: [file] }));

export function saveFile(file) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file); a.download = file.name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
/** Must be called straight from a tap. → 'shared' | 'cancelled' | 'copied' | 'saved' */
export async function shareFile(file) {
  if (canShareFiles(file)) {
    try { await navigator.share({ files: [file] }); return 'shared'; } catch (e) { if (e.name === 'AbortError') return 'cancelled'; }
  }
  // Desktop: a PNG goes to the clipboard so it can be pasted into WhatsApp Web; anything else is saved.
  if (file.type === 'image/png') {
    try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': file })]); return 'copied'; } catch { /* save instead */ }
  }
  saveFile(file);
  return 'saved';
}
