// SSE Event Stream — real-time updates from the Worker
const stream = {
  requestId: null,
  events: [],
  lastEventCount: 0,
  _pollTimer: null,
  _statusTimer: null,

  connect(requestId) {
    this.disconnect();
    this.requestId = requestId;
    this.events = [];
    this.lastEventCount = 0;

    // Poll events every 2s
    this._pollTimer = setInterval(() => this.pollEvents(), 2000);
    this.pollEvents();

    // Poll status every 3s
    this._statusTimer = setInterval(() => this.pollStatus(), 3000);
    this.pollStatus();
  },

  disconnect() {
    if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
    if (this._statusTimer) { clearInterval(this._statusTimer); this._statusTimer = null; }
  },

  async pollEvents() {
    if (!this.requestId) return;
    try {
      const result = await api.getEvents(this.requestId);
      if (result.success && result.data && result.data.events) {
        const events = result.data.events;
        // Process only new events
        while (this.lastEventCount < events.length) {
          const evt = events[this.lastEventCount];
          this.handleEvent(evt);
          this.lastEventCount++;
        }
      }
    } catch (e) {
      console.warn('Event poll error:', e);
    }
  },

  async pollStatus() {
    if (!this.requestId) return;
    try {
      const result = await api.getStatus(this.requestId);
      if (result.success && result.data) {
        this.handleStatusUpdate(result.data);
      }
    } catch {}
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
      case 'log': this.onLog(event.data); break;
    }
  },

  // ── Log to Logs Panel ──
  logEvent(event) {
    const container = document.getElementById('logs-body');
    if (!container) return;
    const placeholder = container.querySelector('.log-placeholder');
    if (placeholder) placeholder.remove();

    const time = new Date(event.timestamp || Date.now()).toLocaleTimeString();
    const type = event.type || 'unknown';
    const msg = this.formatLogMessage(event);

    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = `
      <span class="log-time">${time}</span>
      <span class="log-type ${type}">${this.formatTypeName(type)}</span>
      <span class="log-msg">${this.escapeHtml(msg)}</span>
    `;
    container.appendChild(entry);
    container.scrollTop = container.scrollHeight;
  },

  formatLogMessage(event) {
    const d = event.data || {};
    switch (event.type) {
      case 'role-start': return `Starting ${d.role || 'unknown'} phase`;
      case 'role-complete': return `${d.role || 'unknown'} complete${d.output ? ': ' + String(d.output).slice(0, 120) : ''}`;
      case 'thought': return d.message || d.text || JSON.stringify(d).slice(0, 200);
      case 'code-change': return `Code: ${(d.code || d.diff || '').slice(0, 150)}`;
      case 'file-create': return `Created: ${d.path || ''}`;
      case 'status-update': return `Status: ${d.status || ''}`;
      case 'log': return d.message || d.line || JSON.stringify(d).slice(0, 150);
      case 'error': return `Error: ${d.message || d.error || ''}`;
      default: return JSON.stringify(d).slice(0, 200);
    }
  },

  formatTypeName(type) {
    const names = {
      'role-start': 'PHASE', 'role-complete': 'DONE',
      'thought': 'THINK', 'code-change': 'CODE',
      'file-create': 'FILE', 'status-update': 'STATUS',
      'log': 'LOG', 'error': 'ERR',
    };
    return names[type] || type.slice(0, 4).toUpperCase();
  },

  escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  },

  // ── Status Update ──
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
          if (role.output) card.querySelector('.role-output').textContent = String(role.output).slice(0, 200);
        }
      });
    }

    // Update build/test results
    if (data.buildSuccess !== undefined) {
      const el = document.getElementById('build-result');
      if (el) { el.className = `result-card ${data.buildSuccess ? 'passed' : 'failed'}`; el.querySelector('.result-value').textContent = data.buildSuccess ? '✓ Passed' : '✗ Failed'; }
    }
    if (data.testSuccess !== undefined) {
      const el = document.getElementById('test-result');
      if (el) { el.className = `result-card ${data.testSuccess ? 'passed' : 'failed'}`; el.querySelector('.result-value').textContent = data.testSuccess ? '✓ Passed' : '✗ Failed'; }
    }

    // Update files
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

  // ── Event Handlers ──
  onRoleStart(data) {
    const role = data.role || 'unknown';
    const phaseMap = { architect: 2, planner: 2, engineer: 3, tester: 4, reviewer: 5, documenter: 5, pm: 6 };
    workflow.setStep(phaseMap[role] || 3);

    const card = document.querySelector(`.role-card[data-role="${role}"]`);
    if (card) { card.className = 'role-card running'; card.querySelector('.role-status').textContent = '⏳ Running...'; }

    this.appendPhaseHeader(role);
  },

  onRoleComplete(data) {
    const role = data.role || 'unknown';
    const card = document.querySelector(`.role-card[data-role="${role}"]`);
    if (card) {
      card.className = 'role-card completed';
      card.querySelector('.role-status').textContent = '✓ Complete';
      if (data.output) card.querySelector('.role-output').textContent = String(data.output).slice(0, 200);
    }
  },

  onThought(data) { this.appendOutput('thought', data.message || data.text || JSON.stringify(data)); },
  onCodeChange(data) { this.appendOutput('code', data.code || data.diff || JSON.stringify(data)); },
  onFileCreate(data) {
    this.appendOutput('file', `Created: ${data.path}`);
    if (data.content) editor.addFile(data.path, data.content);
  },
  onLog(data) { this.appendOutput('log', data.message || data.line || JSON.stringify(data)); },
  onSummary(data) { this.showSummary(data); },
  onError(data) { this.appendOutput('error', `Error: ${data.message || data.error || 'Unknown'}`); },

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
    const badges = { thought: 'THOUGHT', code: 'CODE', file: 'FILE', error: 'ERROR', status: 'STATUS', log: 'LOG' };
    line.innerHTML = `<span class="output-time">${time}</span><span class="output-badge ${type}">${badges[type] || type.toUpperCase()}</span><span class="output-text">${this.escapeHtml(text)}</span>`;
    container.appendChild(line);
    container.scrollTop = container.scrollHeight;
  },

  // ── Summary ──
  showSummary(data) {
    workflow.stopTimer();
    workflow.setStep(6);
    const container = document.getElementById('summary-content');
    if (!container) return;
    const ok = data.status === 'completed';
    const dur = workflow.getDuration();

    container.innerHTML = `
      <div class="summary-header">
        <div class="summary-icon">${ok ? '🎉' : '❌'}</div>
        <div class="summary-title ${ok ? 'success' : 'failed'}">${ok ? 'Task Completed Successfully' : 'Task Failed'}</div>
      </div>
      <div class="summary-stats">
        <div class="summary-stat"><div class="stat-value">${dur}</div><div class="stat-label">Duration</div></div>
        <div class="summary-stat"><div class="stat-value">${data.modifiedFiles?.length || 0}</div><div class="stat-label">Files Changed</div></div>
        <div class="summary-stat"><div class="stat-value">${data.commitSha ? data.commitSha.slice(0, 7) : '—'}</div><div class="stat-label">Commit</div></div>
      </div>
      ${data.repository ? `<div class="summary-section"><h3>Details</h3><ul>
        <li><strong>Repository:</strong> <a href="https://github.com/${data.repository}" target="_blank" style="color:#3b82f6">${data.repository}</a></li>
        <li><strong>Branch:</strong> ${data.branch || 'main'}</li>
        <li><strong>Task ID:</strong> ${data.id || workflow.requestId}</li>
        ${data.commitSha ? `<li><strong>Commit:</strong> <a href="https://github.com/${data.repository}/commit/${data.commitSha}" target="_blank" style="color:#3b82f6">${data.commitSha.slice(0, 7)}</a></li>` : ''}
      </ul></div>` : ''}
      ${data.modifiedFiles?.length > 0 ? `<div class="summary-section"><h3>Files (${data.modifiedFiles.length})</h3><ul>${data.modifiedFiles.map(f => `<li>📄 ${f}</li>`).join('')}</ul></div>` : ''}
      ${data.prUrl ? `<a class="summary-link" href="${data.prUrl}" target="_blank">View Pull Request →</a>` : ''}
      <div style="margin-top:16px"><button class="btn-primary" onclick="location.reload()">Start New Task</button></div>
    `;
  },
};
