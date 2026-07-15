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
    else { statusEl.textContent = '✓ Connected'; statusEl.className = 'ok'; }
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

// Demographics: user-declared once, stored ONLY in chrome.storage (never sent to Freelanly).
const DEMO_IDS = ['gender', 'race', 'disability', 'veteran'];
(async () => {
  const { demo } = await chrome.storage.sync.get('demo');
  if (demo) DEMO_IDS.forEach((k) => { const el = document.getElementById(`d-${k}`); if (el && demo[k]) el.value = demo[k]; });
})();
document.getElementById('save-demo').addEventListener('click', async () => {
  const demo = {};
  DEMO_IDS.forEach((k) => { const v = document.getElementById(`d-${k}`).value; if (v) demo[k] = v; });
  await chrome.storage.sync.set({ demo });
  const btn = document.getElementById('save-demo');
  btn.textContent = '✓ Saved';
  setTimeout(() => { btn.textContent = 'Save demographics'; }, 1500);
});
