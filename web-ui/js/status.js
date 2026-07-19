// Status page logic
let requestId = null;
let stopPoll = null;

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  requestId = urlParams.get('id');

  if (requestId) {
    document.getElementById('status-task-id').textContent = `Task: ${requestId.slice(0, 8)}...`;
    loadStatus();
    stopPoll = startStatusPolling(requestId, updateUI);
  } else {
    document.getElementById('logs-container').innerHTML = '<span style="color:var(--error)">No request ID provided</span>';
  }
});

async function loadStatus() {
  if (!requestId) return;
  try {
    const result = await api.getStatus(requestId);
    if (result.success && result.data) updateUI(result.data);
  } catch (error) {
    document.getElementById('logs-container').innerHTML = `<span style="color:var(--error)">${error.message}</span>`;
  }
}

function updateUI(data) {
  // Badge
  const badge = document.getElementById('status-badge');
  badge.textContent = data.status;
  badge.style.background = data.status === 'completed' ? 'var(--success-dim)' :
    data.status === 'failed' ? 'var(--error-dim)' : 'var(--primary-dim)';
  badge.style.color = data.status === 'completed' ? 'var(--success)' :
    data.status === 'failed' ? 'var(--error)' : 'var(--primary)';

  // Info
  document.getElementById('request-id').textContent = data.id || '—';
  document.getElementById('repository').textContent = data.repository || '—';
  document.getElementById('branch').textContent = data.branch || '—';
  document.getElementById('created-at').textContent = data.createdAt ? new Date(data.createdAt).toLocaleString() : '—';

  // Progress steps
  const statusOrder = ['pending', 'dispatched', 'running', 'building', 'testing', 'completed'];
  const currentIndex = statusOrder.indexOf(data.status);
  document.querySelectorAll('#progress-steps .step-item').forEach(el => {
    const stepStatus = el.dataset.step;
    const stepIndex = statusOrder.indexOf(stepStatus);
    el.style.borderColor = stepIndex < currentIndex ? 'var(--success)' :
      stepIndex === currentIndex ? 'var(--primary)' : 'var(--border)';
    el.style.background = stepIndex < currentIndex ? 'var(--success-dim)' :
      stepIndex === currentIndex ? 'var(--primary-dim)' : 'var(--bg-dark)';
  });

  // Terminal states
  const terminal = ['completed', 'failed', 'rate-limited', 'cancelled'];
  if (terminal.includes(data.status)) {
    if (stopPoll) stopPoll();
    const resultSection = document.getElementById('result-section');
    resultSection.style.display = 'block';

    if (data.status === 'completed' && data.prUrl) {
      document.getElementById('pr-link').style.display = 'block';
      document.getElementById('pr-url').href = data.prUrl;
    }
    if (data.status === 'failed') {
      document.getElementById('error-message').style.display = 'block';
      document.getElementById('error-text').textContent = data.errorMessage || 'Request failed';
    }
  }

  // Load logs
  loadLogs();
}

async function loadLogs() {
  if (!requestId) return;
  try {
    const result = await api.getLogs(requestId);
    if (result.success && result.data && result.data.lines && result.data.lines.length > 0) {
      document.getElementById('logs-container').textContent = result.data.lines.join('\n');
    }
  } catch {}
}

window.addEventListener('beforeunload', () => { if (stopPoll) stopPoll(); });
