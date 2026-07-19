// SSE Event Stream — real-time updates from the Worker
const stream = {
  eventSource: null,
  requestId: null,
  events: [],
  currentPhase: null,

  connect(requestId) {
    this.disconnect();
    this.requestId = requestId;
    this.events = [];

    // Try SSE first, fall back to polling
    const url = `${API_CONFIG.WORKER_URL}/api/events/${requestId}`;
    try {
      this.eventSource = new EventSource(url);
      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleEvent(data);
        } catch {}
      };
      this.eventSource.onerror = () => {
        console.warn('SSE error, using polling');
        this.eventSource.close();
        this.eventSource = null;
        this.startPolling();
      };
    } catch {
      this.startPolling();
    }

    // Always poll status as backup (every 3s)
    this._statusTimer = setInterval(async () => {
      try {
        const result = await api.getStatus(requestId);
        if (result.success && result.data) {
          this.handleStatusUpdate(result.data);
        }
      } catch {}
    }, 3000);
  },

  startPolling() {
    if (this._pollTimer) return;
    this._pollTimer = setInterval(async () => {
      try {
        const result = await api.getEvents(this.requestId);
        if (result.success && result.data && result.data.notifications) {
          const newEvents = result.data.notifications.slice(this.events.length);
          for (const evt of newEvents) {
            try {
              const parsed = typeof evt === 'string' ? JSON.parse(evt) : evt;
              this.handleEvent(parsed);
              this.events.push(parsed);
            } catch {}
          }
        }
      } catch {}
    }, 2000);
  },

  disconnect() {
    if (this.eventSource) { this.eventSource.close(); this.eventSource = null; }
    if (this._statusTimer) { clearInterval(this._statusTimer); this._statusTimer = null; }
    if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
  },

  handleEvent(event) {
    this.logEvent(event);
    switch (event.type) {
      case 'role-start': this.onRoleStart(event.data); break;
      case 'role-complete': this.onRoleComplete(event.data); break;
      case 'thought': this.onThought(event.data); break;
      case 'code-change': this.onCodeChange(event.data); break;
      case 'file-create': this.onFileCreate(event.data); break;
      case 'status-update': this.onStatusUpdate(event.data); break;
      case 'summary': this.onSummary(event.data); break;
      case 'error': this.onError(event.data); break;
      case 'stream-end': this.onStreamEnd(); break;
    }
  },

  // ── Log Event to Logs Panel ──
  logEvent(event) {
    const container = document.getElementById('logs-body');
    if (!container) return;
    // Clear placeholder
    const placeholder = container.querySelector('.log-placeholder');
    if (placeholder) placeholder.remove();

    const time = new Date(event.timestamp || Date.now()).toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = `
      <span class="log-time">${time}</span>
      <span class="log-type ${event.type}">${event.type}</span>
      <span class="log-msg">${this.formatLogMessage(event)}</span>
    `;
    container.appendChild(entry);
    container.scrollTop = container.scrollHeight;
  },

  formatLogMessage(event) {
    const d = event.data || {};
    switch (event.type) {
      case 'role-start': return `Starting ${d.role || 'unknown'} phase`;
      case 'role-complete': return `${d.role || 'unknown'} phase complete${d.output ? ': ' + d.output.slice(0, 100) : ''}`;
      case 'thought': return d.message || d.text || JSON.stringify(d).slice(0, 200);
      case 'code-change': return `Code: ${(d.code || d.diff || '').slice(0, 150)}`;
      case 'file-create': return `Created: ${d.path || 'unknown'}`;
      case 'status-update': return `Status: ${d.status || 'unknown'}`;
      case 'error': return `Error: ${d.message || d.error || 'Unknown'}`;
      default: return JSON.stringify(d).slice(0, 200);
    }
  },

  // ── Status Update Handler ──
  handleStatusUpdate(data) {
    // Update role cards
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
      if (el) {
        el.className = `result-card ${data.buildSuccess ? 'passed' : 'failed'}`;
        el.querySelector('.result-value').textContent = data.buildSuccess ? '✓ Passed' : '✗ Failed';
      }
    }
    if (data.testSuccess !== undefined) {
      const el = document.getElementById('test-result');
      if (el) {
        el.className = `result-card ${data.testSuccess ? 'passed' : 'failed'}`;
        el.querySelector('.result-value').textContent = data.testSuccess ? '✓ Passed' : '✗ Failed';
      }
    }

    // Update files changed
    if (data.modifiedFiles && data.modifiedFiles.length > 0) {
      const container = document.getElementById('files-changed');
      if (container) {
        container.innerHTML = data.modifiedFiles.map(f => `
          <div class="file-item" onclick="editor.openFile('${f}')">
            <span class="file-icon">${editor.getFileIcon(f)}</span>
            <span class="file-path">${f}</span>
          </div>
        `).join('');
      }
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

  // ── Role Handlers ──
  onRoleStart(data) {
    const role = data.role || 'unknown';
    const phaseMap = { architect: 2, planner: 2, engineer: 3, tester: 4, reviewer: 5, documenter: 5, pm: 6 };
    const step = phaseMap[role] || 3;
    workflow.setStep(step);
    this.currentPhase = role;

    // Highlight role card
    const card = document.querySelector(`.role-card[data-role="${role}"]`);
    if (card) {
      card.className = 'role-card running';
      card.querySelector('.role-status').textContent = '⏳ Running...';
    }

    // Add phase header to output
    this.appendPhaseHeader(role);
  },

  onRoleComplete(data) {
    const role = data.role || 'unknown';
    const card = document.querySelector(`.role-card[data-role="${role}"]`);
    if (card) {
      card.className = 'role-card completed';
      card.querySelector('.role-status').textContent = '✓ Complete';
      if (data.output) {
        card.querySelector('.role-output').textContent = data.output.slice(0, 200);
      }
    }
  },

  onThought(data) {
    this.appendOutput('thought', data.message || data.text || JSON.stringify(data));
  },

  onCodeChange(data) {
    this.appendOutput('code', data.code || data.diff || JSON.stringify(data));
  },

  onFileCreate(data) {
    this.appendOutput('file', `Created: ${data.path}`);
    if (data.content) {
      editor.addFile(data.path, data.content);
    }
  },

  onSummary(data) { this.showSummary(data); },
  onError(data) { this.appendOutput('error', `Error: ${data.message || data.error || 'Unknown'}`); },
  onStreamEnd() { this.disconnect(); },

  // ── Output Helpers ──
  appendPhaseHeader(role) {
    const container = document.getElementById('agent-output');
    if (!container) return;
    const names = { architect: 'Architect', planner: 'Planner', engineer: 'Engineer', tester: 'Tester', reviewer: 'Reviewer', documenter: 'Documenter', pm: 'Product Manager' };
    const icons = { architect: '🏗️', planner: '📋', engineer: '⚙️', tester: '🧪', reviewer: '🔍', documenter: '📝', pm: '📊' };
    const line = document.createElement('div');
    line.className = 'output-line phase-header';
    line.innerHTML = `<span class="output-badge phase">${icons[role] || '▶'} ${(names[role] || role).toUpperCase()}</span>`;
    container.appendChild(line);
    container.scrollTop = container.scrollHeight;
  },

  appendOutput(type, text) {
    const container = document.getElementById('agent-output');
    if (!container) return;
    const line = document.createElement('div');
    line.className = `output-line ${type === 'code' ? 'code-block' : ''}`;
    const time = new Date().toLocaleTimeString();
    const badges = { thought: 'THOUGHT', code: 'CODE', file: 'FILE', error: 'ERROR', status: 'STATUS' };
    line.innerHTML = `<span class="output-time">${time}</span><span class="output-badge ${type}">${badges[type] || type.toUpperCase()}</span><span class="output-text">${this.escapeHtml(text)}</span>`;
    container.appendChild(line);
    container.scrollTop = container.scrollHeight;
  },

  escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  },

  // ── Summary ──
  showSummary(data) {
    workflow.stopTimer();
    workflow.setStep(6);
    const container = document.getElementById('summary-content');
    if (!container) return;
    const isSuccess = data.status === 'completed';
    const duration = workflow.getDuration();

    container.innerHTML = `
      <div class="summary-header">
        <div class="summary-icon">${isSuccess ? '🎉' : '❌'}</div>
        <div class="summary-title ${isSuccess ? 'success' : 'failed'}">${isSuccess ? 'Task Completed Successfully' : 'Task Failed'}</div>
      </div>
      <div class="summary-stats">
        <div class="summary-stat"><div class="stat-value">${duration}</div><div class="stat-label">Duration</div></div>
        <div class="summary-stat"><div class="stat-value">${data.modifiedFiles?.length || 0}</div><div class="stat-label">Files Changed</div></div>
        <div class="summary-stat"><div class="stat-value">${data.commitSha ? data.commitSha.slice(0, 7) : '—'}</div><div class="stat-label">Commit</div></div>
      </div>
      ${data.repository ? `<div class="summary-section"><h3>Details</h3><ul>
        <li><strong>Repository:</strong> <a href="https://github.com/${data.repository}" target="_blank" style="color:var(--primary)">${data.repository}</a></li>
        <li><strong>Branch:</strong> ${data.branch || 'main'}</li>
        <li><strong>Task ID:</strong> ${data.id || workflow.requestId}</li>
        ${data.commitSha ? `<li><strong>Commit:</strong> <a href="https://github.com/${data.repository}/commit/${data.commitSha}" target="_blank" style="color:var(--primary)">${data.commitSha.slice(0, 7)}</a></li>` : ''}
      </ul></div>` : ''}
      ${data.modifiedFiles?.length > 0 ? `<div class="summary-section"><h3>Files (${data.modifiedFiles.length})</h3><ul>${data.modifiedFiles.map(f => `<li>📄 ${f}</li>`).join('')}</ul></div>` : ''}
      ${data.prUrl ? `<a class="summary-link" href="${data.prUrl}" target="_blank">View Pull Request →</a>` : ''}
      <div style="margin-top:16px"><button class="btn-primary" onclick="location.reload()">Start New Task</button></div>
    `;
  },
};
