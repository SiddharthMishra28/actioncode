// Main App Controller
document.addEventListener('DOMContentLoaded', () => {
  workflow.init();
  loadTaskHistory();
  checkHealth();
});

async function loadTaskHistory() {
  try {
    const result = await api.listTasks(10);
    if (result.success && result.data && result.data.tasks) {
      const container = document.getElementById('task-history');
      const empty = container.querySelector('.task-history-empty');
      if (empty && result.data.tasks.length > 0) empty.remove();

      for (const task of result.data.tasks.slice(0, 5)) {
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
  } catch {}
}

async function checkHealth() {
  try {
    const result = await api.healthCheck();
    const statusEl = document.getElementById('status-connection');
    const headerStatus = document.getElementById('connection-status');
    if (result.status === 'healthy') {
      statusEl.textContent = '● Connected';
      statusEl.style.color = 'var(--success)';
      headerStatus.textContent = '● Connected';
      headerStatus.style.color = 'var(--success)';
    }
  } catch {
    const statusEl = document.getElementById('status-connection');
    const headerStatus = document.getElementById('connection-status');
    statusEl.textContent = '● Disconnected';
    statusEl.style.color = 'var(--error)';
    headerStatus.textContent = '● Disconnected';
    headerStatus.style.color = 'var(--error)';
  }
}
