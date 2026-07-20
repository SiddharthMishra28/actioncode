// Status page logic
let requestId = null;
let stopPoll = null;
let lastEventCount = 0;

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  requestId = urlParams.get('id');

  if (requestId) {
    document.getElementById('status-task-id').textContent = `Task: ${requestId.slice(0, 8)}...`;
    loadStatus();
    stopPoll = startStatusPolling(requestId, updateUI, 3000);
    // Poll events every 2s
    loadEvents();
    setInterval(loadEvents, 2000);
  } else {
    const lc = document.getElementById('logs-container');
    if (lc) lc.innerHTML = '<span style="color:#f85149">No request ID provided</span>';
  }
});

async function loadStatus() {
  if (!requestId) return;
  try {
    const result = await api.getStatus(requestId);
    if (result.success && result.data) updateUI(result.data);
  } catch (error) {
    const lc = document.getElementById('logs-container');
    if (lc) lc.innerHTML = `<span style="color:#f85149">${error.message}</span>`;
  }
}

async function loadEvents() {
  if (!requestId) return;
  try {
    const result = await api.getEvents(requestId);
    if (result.success && result.data && result.data.events) {
      const events = result.data.events;
      if (events.length === lastEventCount) return; // no new events
      lastEventCount = events.length;

      const container = document.getElementById('logs-container');
      if (!container) return;
      container.innerHTML = '';

      for (const evt of events) {
        const time = new Date(evt.timestamp).toLocaleTimeString();
        const type = evt.type || 'unknown';
        const msg = formatEventMessage(evt);
        const entry = document.createElement('div');
        entry.style.cssText = 'display:flex;gap:8px;padding:3px 0;font-size:11px;font-family:var(--font-mono);border-bottom:1px solid rgba(48,54,61,0.3)';
        entry.innerHTML = `
          <span style="color:#6e7681;min-width:60px">${time}</span>
          <span style="display:inline-block;padding:0 5px;border-radius:2px;font-size:9px;font-weight:700;min-width:80px;text-align:center;background:${getTypeBg(type)};color:${getTypeColor(type)}">${formatTypeName(type)}</span>
          <span style="color:#8b949e;flex:1;word-break:break-word">${escapeHtml(msg)}</span>
        `;
        container.appendChild(entry);
      }
      container.scrollTop = container.scrollHeight;
    }
  } catch (e) {
    console.warn('Events load error:', e);
  }
}

function formatEventMessage(evt) {
  const d = evt.data || {};
  switch (evt.type) {
    case 'role-start': return `Starting ${d.role || 'unknown'} phase`;
    case 'role-complete': return `${d.role || 'unknown'} complete${d.output ? ': ' + String(d.output).slice(0, 120) : ''}`;
    case 'thought': return d.message || d.text || JSON.stringify(d).slice(0, 150);
    case 'code-change': return `Code: ${(d.code || d.diff || '').slice(0, 120)}`;
    case 'file-create': return `Created: ${d.path || ''}`;
    case 'status-update': return `Status: ${d.status || ''}`;
    case 'log': return d.message || d.line || JSON.stringify(d).slice(0, 150);
    case 'error': return `Error: ${d.message || d.error || ''}`;
    default: return JSON.stringify(d).slice(0, 150);
  }
}

function formatTypeName(type) {
  const names = {
    'role-start': 'PHASE START', 'role-complete': 'PHASE DONE',
    'thought': 'THOUGHT', 'code-change': 'CODE',
    'file-create': 'FILE', 'status-update': 'STATUS',
    'log': 'LOG', 'error': 'ERROR',
  };
  return names[type] || type.toUpperCase();
}

function getTypeBg(type) {
  const c = {
    'role-start': 'rgba(59,130,246,0.15)', 'role-complete': 'rgba(63,185,80,0.15)',
    'thought': 'rgba(163,113,247,0.15)', 'code-change': 'rgba(63,185,80,0.15)',
    'file-create': 'rgba(210,153,34,0.15)', 'status-update': 'rgba(59,130,246,0.15)',
    'log': 'rgba(100,116,139,0.15)', 'error': 'rgba(248,81,73,0.15)',
  };
  return c[type] || 'rgba(100,116,139,0.15)';
}

function getTypeColor(type) {
  const c = {
    'role-start': '#3b82f6', 'role-complete': '#3fb950',
    'thought': '#a371f7', 'code-change': '#3fb950',
    'file-create': '#d29922', 'status-update': '#3b82f6',
    'log': '#8b949e', 'error': '#f85149',
  };
  return c[type] || '#8b949e';
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function updateUI(data) {
  const badge = document.getElementById('status-badge');
  if (badge) {
    badge.textContent = data.status;
    const colors = { completed: ['#3fb950','rgba(63,185,80,0.15)'], failed: ['#f85149','rgba(248,81,73,0.15)'] };
    const [c, bg] = colors[data.status] || ['#3b82f6','rgba(59,130,246,0.15)'];
    badge.style.background = bg;
    badge.style.color = c;
  }

  const rid = document.getElementById('request-id');
  if (rid) rid.textContent = data.id || '—';
  const repo = document.getElementById('repository');
  if (repo) repo.textContent = data.repository || '—';
  const br = document.getElementById('branch');
  if (br) br.textContent = data.branch || '—';
  const ca = document.getElementById('created-at');
  if (ca) ca.textContent = data.createdAt ? new Date(data.createdAt).toLocaleString() : '—';

  const statusOrder = ['pending', 'dispatched', 'running', 'building', 'testing', 'completed'];
  const ci = statusOrder.indexOf(data.status);
  document.querySelectorAll('#progress-steps .step-item').forEach(el => {
    const si = statusOrder.indexOf(el.dataset.step);
    el.style.borderColor = si < ci ? '#3fb950' : si === ci ? '#3b82f6' : '#30363d';
    el.style.background = si < ci ? 'rgba(63,185,80,0.15)' : si === ci ? 'rgba(59,130,246,0.15)' : '#161b22';
  });

  const terminal = ['completed', 'failed', 'rate-limited', 'cancelled'];
  if (terminal.includes(data.status)) {
    if (stopPoll) stopPoll();
    const rs = document.getElementById('result-section');
    if (rs) rs.style.display = 'block';
    if (data.status === 'completed' && data.prUrl) {
      const pl = document.getElementById('pr-link');
      if (pl) { pl.style.display = 'block'; document.getElementById('pr-url').href = data.prUrl; }
    }
    if (data.status === 'failed') {
      const em = document.getElementById('error-message');
      if (em) { em.style.display = 'block'; document.getElementById('error-text').textContent = data.errorMessage || 'Request failed'; }
    }
  }
}

window.addEventListener('beforeunload', () => { if (stopPoll) stopPoll(); });
