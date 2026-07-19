// Status page logic
let requestId = null;
let stopPoll = null;

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  requestId = urlParams.get('id');

  if (requestId) {
    document.getElementById('status-task-id').textContent = `Task: ${requestId.slice(0, 8)}...`;
    loadStatus();
    // Poll status every 3s
    stopPoll = startStatusPolling(requestId, updateUI, 3000);
    // Also load events for logs
    loadEvents();
    setInterval(loadEvents, 3000);
  } else {
    const lc = document.getElementById('logs-container');
    if (lc) lc.innerHTML = '<span style="color:var(--error)">No request ID provided</span>';
  }
});

async function loadStatus() {
  if (!requestId) return;
  try {
    const result = await api.getStatus(requestId);
    if (result.success && result.data) updateUI(result.data);
  } catch (error) {
    const lc = document.getElementById('logs-container');
    if (lc) lc.innerHTML = `<span style="color:var(--error)">${error.message}</span>`;
  }
}

async function loadEvents() {
  if (!requestId) return;
  try {
    const result = await api.getNotifications(requestId);
    if (result.success && result.data && result.data.notifications && result.data.notifications.length > 0) {
      const container = document.getElementById('logs-container');
      if (!container) return;
      container.innerHTML = '';
      for (const evt of result.data.notifications) {
        try {
          const parsed = typeof evt === 'string' ? JSON.parse(evt) : evt;
          const time = new Date(parsed.timestamp).toLocaleTimeString();
          const type = parsed.type || 'unknown';
          const msg = formatEventMessage(parsed);
          const entry = document.createElement('div');
          entry.style.cssText = 'display:flex;gap:8px;padding:2px 0;font-size:11px;font-family:var(--font-mono);border-bottom:1px solid rgba(48,54,61,0.3)';
          entry.innerHTML = `
            <span style="color:#6e7681;min-width:60px">${time}</span>
            <span style="display:inline-block;padding:0 4px;border-radius:2px;font-size:9px;font-weight:600;min-width:70px;text-align:center;background:${getTypeColor(type)};color:${getTypeTextColor(type)}">${type}</span>
            <span style="color:#8b949e;flex:1;word-break:break-word">${escapeHtml(msg)}</span>
          `;
          container.appendChild(entry);
        } catch {}
      }
      container.scrollTop = container.scrollHeight;
    }
  } catch {}
}

function formatEventMessage(event) {
  const d = event.data || {};
  switch (event.type) {
    case 'role-start': return `Starting ${d.role || 'unknown'} phase`;
    case 'role-complete': return `${d.role || 'unknown'} complete${d.output ? ': ' + d.output.slice(0, 100) : ''}`;
    case 'thought': return d.message || d.text || '';
    case 'code-change': return `Code: ${(d.code || '').slice(0, 120)}`;
    case 'file-create': return `Created: ${d.path || ''}`;
    case 'status-update': return `Status: ${d.status || ''}`;
    case 'error': return `Error: ${d.message || d.error || ''}`;
    default: return JSON.stringify(d).slice(0, 150);
  }
}

function getTypeColor(type) {
  const colors = {
    'role-start': 'rgba(59,130,246,0.15)', 'role-complete': 'rgba(63,185,80,0.15)',
    'thought': 'rgba(163,113,247,0.15)', 'code-change': 'rgba(63,185,80,0.15)',
    'file-create': 'rgba(210,153,34,0.15)', 'status-update': 'rgba(59,130,246,0.15)',
    'error': 'rgba(248,81,73,0.15)',
  };
  return colors[type] || 'rgba(100,116,139,0.15)';
}

function getTypeTextColor(type) {
  const colors = {
    'role-start': '#3b82f6', 'role-complete': '#3fb950',
    'thought': '#a371f7', 'code-change': '#3fb950',
    'file-create': '#d29922', 'status-update': '#3b82f6',
    'error': '#f85149',
  };
  return colors[type] || '#8b949e';
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function updateUI(data) {
  const badge = document.getElementById('status-badge');
  if (badge) {
    badge.textContent = data.status;
    badge.style.background = data.status === 'completed' ? 'rgba(63,185,80,0.15)' :
      data.status === 'failed' ? 'rgba(248,81,73,0.15)' : 'rgba(59,130,246,0.15)';
    badge.style.color = data.status === 'completed' ? '#3fb950' :
      data.status === 'failed' ? '#f85149' : '#3b82f6';
  }

  const rid = document.getElementById('request-id');
  if (rid) rid.textContent = data.id || '—';
  const repo = document.getElementById('repository');
  if (repo) repo.textContent = data.repository || '—';
  const br = document.getElementById('branch');
  if (br) br.textContent = data.branch || '—';
  const ca = document.getElementById('created-at');
  if (ca) ca.textContent = data.createdAt ? new Date(data.createdAt).toLocaleString() : '—';

  // Progress steps
  const statusOrder = ['pending', 'dispatched', 'running', 'building', 'testing', 'completed'];
  const currentIndex = statusOrder.indexOf(data.status);
  document.querySelectorAll('#progress-steps .step-item').forEach(el => {
    const stepStatus = el.dataset.step;
    const stepIndex = statusOrder.indexOf(stepStatus);
    el.style.borderColor = stepIndex < currentIndex ? '#3fb950' :
      stepIndex === currentIndex ? '#3b82f6' : '#30363d';
    el.style.background = stepIndex < currentIndex ? 'rgba(63,185,80,0.15)' :
      stepIndex === currentIndex ? 'rgba(59,130,246,0.15)' : '#161b22';
  });

  // Terminal states
  const terminal = ['completed', 'failed', 'rate-limited', 'cancelled'];
  if (terminal.includes(data.status)) {
    if (stopPoll) stopPoll();
    const resultSection = document.getElementById('result-section');
    if (resultSection) resultSection.style.display = 'block';

    if (data.status === 'completed' && data.prUrl) {
      const prLink = document.getElementById('pr-link');
      if (prLink) {
        prLink.style.display = 'block';
        document.getElementById('pr-url').href = data.prUrl;
      }
    }
    if (data.status === 'failed') {
      const errMsg = document.getElementById('error-message');
      if (errMsg) {
        errMsg.style.display = 'block';
        document.getElementById('error-text').textContent = data.errorMessage || 'Request failed';
      }
    }
  }
}

window.addEventListener('beforeunload', () => { if (stopPoll) stopPoll(); });
