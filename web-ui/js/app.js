// Main App Controller
document.addEventListener('DOMContentLoaded', () => {
  workflow.init();
  loadTaskHistory();
  checkHealth();
  // Recheck health every 30s
  setInterval(checkHealth, 30000);
});

async function loadTaskHistory() {
  try {
    const result = await api.listTasks(10);
    if (result.success && result.data && result.data.tasks) {
      const container = document.getElementById('task-history');
      const empty = container.querySelector('.task-history-empty');
      if (empty && result.data.tasks.length > 0) empty.remove();

      for (const task of result.data.tasks.slice(0, 8)) {
        const item = document.createElement('div');
        const statusClass = task.status === 'completed' ? 'completed' : task.status === 'failed' ? 'failed' : 'running';
        item.className = `task-history-item ${statusClass}`;
        item.dataset.id = task.id;
        const icon = statusClass === 'completed' ? '✓' : statusClass === 'failed' ? '✗' : '●';
        item.innerHTML = `
          <span class="task-icon">${icon}</span>
          <span class="task-label" title="${task.instruction}">${task.instruction.slice(0, 30)}</span>
        `;
        item.onclick = () => workflow.loadTask(task.id);
        container.appendChild(item);
      }
    }
  } catch (e) {
    console.warn('Failed to load task history:', e);
  }
}

async function checkHealth() {
  const statusEl = document.getElementById('status-connection');
  const headerStatus = document.getElementById('connection-status');
  try {
    const response = await fetch(`${API_CONFIG.WORKER_URL}/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (response.ok) {
      const data = await response.json();
      if (data.status === 'healthy' || data.status === 'ok') {
        setConnected(true);
        return;
      }
    }
    setConnected(false);
  } catch (e) {
    console.warn('Health check failed:', e);
    setConnected(false);
  }
}

function setConnected(connected) {
  const statusEl = document.getElementById('status-connection');
  const headerStatus = document.getElementById('connection-status');
  if (statusEl) {
    statusEl.textContent = connected ? '● Connected' : '● Disconnected';
    statusEl.style.color = connected ? 'var(--success)' : 'var(--error)';
  }
  if (headerStatus) {
    headerStatus.textContent = connected ? '● Connected' : '● Disconnected';
    headerStatus.style.color = connected ? 'var(--success)' : 'var(--error)';
  }
}
