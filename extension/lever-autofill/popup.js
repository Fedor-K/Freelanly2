const statusEl = document.getElementById('status');
const tokenEl = document.getElementById('token');

async function refresh() {
  const { token } = await chrome.storage.sync.get('token');
  if (!token) {
    statusEl.textContent = 'Not connected';
    statusEl.className = 'bad';
    return;
  }
  tokenEl.value = token;
  try {
    const r = await fetch('https://freelanly.com/api/extension/profile', { headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json();
    if (d.error) { statusEl.textContent = 'Token invalid — paste a fresh one'; statusEl.className = 'bad'; }
    else if (d.pro) { statusEl.textContent = '✓ Connected — PRO'; statusEl.className = 'ok'; }
    else { statusEl.textContent = 'Connected, but autofill needs PRO ($5/mo)'; statusEl.className = 'bad'; }
  } catch {
    statusEl.textContent = 'Network error';
    statusEl.className = 'bad';
  }
}

document.getElementById('save').addEventListener('click', async () => {
  const token = tokenEl.value.trim();
  if (!token) return;
  await chrome.storage.sync.set({ token });
  refresh();
});

refresh();
