// SSE Event Stream — real-time updates from the Worker
const stream = {
  eventSource: null,
  requestId: null,

  connect(requestId) {
    this.disconnect();
    this.requestId = requestId;

    const url = `${API_CONFIG.WORKER_URL}/api/events/${requestId}`;
    this.eventSource = new EventSource(url);

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleEvent(data);
      } catch {}
    };

    this.eventSource.onerror = () => {
      // Fallback to polling if SSE fails
      console.warn('SSE connection lost, falling back to polling');
      this.disconnect();
      startStatusPolling(requestId, (data) => this.handleStatusUpdate(data));
    };

    // Also poll status as backup
    this._pollTimer = setInterval(async () => {
      try {
        const result = await api.getStatus(requestId);
        if (result.success && result.data) {
          this.handleStatusUpdate(result.data);
        }
      } catch {}
    }, 5000);
  },

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  },

  handleEvent(event) {
    switch (event.type) {
      case 'role-start':
        this.onRoleStart(event.data);
        break;
      case 'role-complete':
        this.onRoleComplete(event.data);
        break;
      case 'thought':
        this.onThought(event.data);
        break;
      case 'code-change':
        this.onCodeChange(event.data);
        break;
      case 'file-create':
        this.onFileCreate(event.data);
        break;
      case 'status-update':
        this.onStatusUpdate(event.data);
        break;
      case 'summary':
        this.onSummary(event.data);
        break;
      case 'error':
        this.onError(event.data);
        break;
      case 'stream-end':
        this.onStreamEnd();
        break;
    }
  },

  handleStatusUpdate(data) {
    // Update role cards in Step 2
    if (data.roles) {
      data.roles.forEach(role => {
        const card = document.querySelector(`.role-card[data-role="${role.role}"]`);
        if (card) {
          card.className = `role-card ${role.status}`;
          card.querySelector('.role-status').textContent =
            role.status === 'completed' ? '✓ Complete' :
            role.status === 'running' ? '⏳ Running...' :
            role.status === 'failed' ? '✗ Failed' : 'Pending';
          if (role.output) {
            card.querySelector('.role-output').textContent = role.output.slice(0, 200);
          }
        }
      });
    }

    // Update build/test results
    if (data.buildSuccess !== undefined) {
      const el = document.getElementById('build-result');
      el.className = `result-card ${data.buildSuccess ? 'passed' : 'failed'}`;
      el.querySelector('.result-value').textContent = data.buildSuccess ? '✓ Passed' : '✗ Failed';
    }
    if (data.testSuccess !== undefined) {
      const el = document.getElementById('test-result');
      el.className = `result-card ${data.testSuccess ? 'passed' : 'failed'}`;
      el.querySelector('.result-value').textContent = data.testSuccess ? '✓ Passed' : '✗ Failed';
    }

    // Update files changed
    if (data.modifiedFiles && data.modifiedFiles.length > 0) {
      const container = document.getElementById('files-changed');
      container.innerHTML = data.modifiedFiles.map(f => `
        <div class="file-item">
          <span class="file-icon">📄</span>
          <span class="file-path">${f}</span>
        </div>
      `).join('');

      // Update file tree
      editor.updateFileTree(data.modifiedFiles);
    }

    // Terminal states
    const terminal = ['completed', 'failed', 'rate-limited', 'cancelled'];
    if (terminal.includes(data.status)) {
      workflow.stopTimer();
      workflow.updateHistoryStatus(workflow.requestId, data.status);

      if (data.status === 'completed') {
        workflow.setStep(6);
        this.showSummary(data);
      } else if (data.status === 'failed') {
        this.appendOutput('error', `Task failed: ${data.errorMessage || 'Unknown error'}`);
      }
    }
  },

  onRoleStart(data) {
    const card = document.querySelector(`.role-card[data-role="${data.role}"]`);
    if (card) {
      card.className = 'role-card running';
      card.querySelector('.role-status').textContent = '⏳ Running...';
    }
    this.appendOutput('status', `▶ ${data.role.charAt(0).toUpperCase() + data.role.slice(1)} phase started`);
    workflow.setStep(3);
  },

  onRoleComplete(data) {
    const card = document.querySelector(`.role-card[data-role="${data.role}"]`);
    if (card) {
      card.className = 'role-card completed';
      card.querySelector('.role-status').textContent = '✓ Complete';
      if (data.output) {
        card.querySelector('.role-output').textContent = data.output.slice(0, 200);
      }
    }
    this.appendOutput('status', `✓ ${data.role.charAt(0).toUpperCase() + data.role.slice(1)} phase complete`);
  },

  onThought(data) {
    this.appendOutput('thought', data.message || data.text || JSON.stringify(data));
  },

  onCodeChange(data) {
    this.appendOutput('code', data.code || data.diff || JSON.stringify(data));
    workflow.setStep(4);
  },

  onFileCreate(data) {
    this.appendOutput('file', `📄 Created: ${data.path}`);
    if (data.content) {
      editor.addFile(data.path, data.content);
    }
  },

  onSummary(data) {
    this.showSummary(data);
  },

  onError(data) {
    this.appendOutput('error', `Error: ${data.message || data.error || 'Unknown error'}`);
  },

  onStreamEnd() {
    this.disconnect();
  },

  appendOutput(type, text) {
    const container = document.getElementById('agent-output');
    if (!container) return;

    const line = document.createElement('div');
    line.className = `output-line ${type}`;
    const time = new Date().toLocaleTimeString();
    line.textContent = `[${time}] ${text}`;
    container.appendChild(line);
    container.scrollTop = container.scrollHeight;
  },

  showSummary(data) {
    workflow.stopTimer();
    workflow.setStep(6);

    const container = document.getElementById('summary-content');
    const isSuccess = data.status === 'completed';
    const duration = workflow.getDuration();

    container.innerHTML = `
      <div class="summary-header">
        <div class="summary-icon">${isSuccess ? '🎉' : '❌'}</div>
        <div class="summary-title ${isSuccess ? 'success' : 'failed'}">
          ${isSuccess ? 'Task Completed Successfully' : 'Task Failed'}
        </div>
      </div>
      <div class="summary-stats">
        <div class="summary-stat">
          <div class="stat-value">${duration}</div>
          <div class="stat-label">Duration</div>
        </div>
        <div class="summary-stat">
          <div class="stat-value">${data.modifiedFiles?.length || 0}</div>
          <div class="stat-label">Files Changed</div>
        </div>
        <div class="summary-stat">
          <div class="stat-value">${data.buildSuccess ? '✓' : data.testSuccess ? '✓' : '—'}</div>
          <div class="stat-label">Build & Test</div>
        </div>
      </div>
      ${data.repository ? `
      <div class="summary-section">
        <h3>Details</h3>
        <ul>
          <li><strong>Repository:</strong> ${data.repository}</li>
          <li><strong>Branch:</strong> ${data.branch || 'main'}</li>
          <li><strong>Task ID:</strong> ${data.id || workflow.requestId}</li>
          ${data.commitSha ? `<li><strong>Commit:</strong> <code>${data.commitSha.slice(0, 7)}</code></li>` : ''}
        </ul>
      </div>` : ''}
      ${data.modifiedFiles && data.modifiedFiles.length > 0 ? `
      <div class="summary-section">
        <h3>Files Changed (${data.modifiedFiles.length})</h3>
        <ul>
          ${data.modifiedFiles.map(f => `<li>📄 ${f}</li>`).join('')}
        </ul>
      </div>` : ''}
      ${data.prUrl ? `
      <a class="summary-link" href="${data.prUrl}" target="_blank">View Pull Request →</a>` : ''}
      <div style="margin-top:20px">
        <button class="btn-primary" onclick="location.reload()">Start New Task</button>
      </div>
    `;
  },
};
