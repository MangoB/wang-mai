// Send text to a chat app: the phone's share sheet when there is one, otherwise the clipboard.
// Returns 'shared', 'copied' or '' (user cancelled or nothing worked).
export async function shareText(text) {
  if (navigator.share) {
    try { await navigator.share({ text }); return 'shared'; } catch (e) { if (e && e.name === 'AbortError') return ''; }
  }
  return (await copyText(text)) ? 'copied' : '';
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}
