// Service worker: all cross-origin calls live here (host_permissions bypass CORS; content scripts
// on jobs.lever.co are bound by the page origin). Content script talks to us via messages.

const API = 'https://freelanly.com/api/extension';

async function getToken() {
  const { token } = await chrome.storage.sync.get('token');
  return token || null;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    const token = await getToken();
    if (!token) return sendResponse({ error: 'no_token' });

    try {
      if (msg.type === 'profile') {
        const r = await fetch(`${API}/profile`, { headers: { Authorization: `Bearer ${token}` } });
        return sendResponse(await r.json());
      }

      if (msg.type === 'answer') {
        const r = await fetch(`${API}/answer`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: msg.question, jobContext: msg.jobContext, options: msg.options }),
        });
        return sendResponse(await r.json());
      }

      if (msg.type === 'resume') {
        // Download the resume PDF and hand it to the content script as base64 (messages are JSON).
        const r = await fetch(msg.url);
        if (!r.ok) return sendResponse({ error: `resume_fetch_${r.status}` });
        const buf = await r.arrayBuffer();
        let bin = '';
        const bytes = new Uint8Array(buf);
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
          bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
        }
        return sendResponse({ base64: btoa(bin), contentType: r.headers.get('content-type') || 'application/pdf' });
      }

      sendResponse({ error: 'unknown_message' });
    } catch (e) {
      sendResponse({ error: String(e && e.message || e) });
    }
  })();
  return true; // keep the channel open for the async response
});
