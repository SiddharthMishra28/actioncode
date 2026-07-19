// Markdown Editor
const mdEditor = {
  mode: 'write',

  init() {
    const textarea = document.getElementById('prompt');
    const charCount = document.getElementById('char-count');
    if (textarea && charCount) {
      textarea.addEventListener('input', () => {
        charCount.textContent = `${textarea.value.length} chars`;
      });
    }
  },

  setMode(mode) {
    this.mode = mode;
    const textarea = document.getElementById('prompt');
    const preview = document.getElementById('md-preview');
    const btnWrite = document.getElementById('md-btn-write');
    const btnPreview = document.getElementById('md-btn-preview');

    if (mode === 'write') {
      textarea.style.display = 'block';
      preview.style.display = 'none';
      btnWrite.classList.add('active');
      btnPreview.classList.remove('active');
    } else {
      textarea.style.display = 'none';
      preview.style.display = 'block';
      btnWrite.classList.remove('active');
      btnPreview.classList.add('active');
      preview.innerHTML = this.renderMarkdown(textarea.value);
    }
  },

  insertFormat(before, after) {
    const textarea = document.getElementById('prompt');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end);
    const replacement = before + (selected || 'text') + after;
    textarea.setRangeText(replacement, start, end, 'select');
    textarea.focus();
    textarea.dispatchEvent(new Event('input'));
  },

  renderMarkdown(text) {
    if (!text) return '<p style="color:var(--text-dim)">Nothing to preview</p>';
    let html = this.escapeHtml(text);
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    html = html.replace(/\n\n/g, '</p><p>');
    html = '<p>' + html + '</p>';
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p>(<h[1-6]>)/g, '$1');
    html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
    html = html.replace(/<p>(<ul>)/g, '$1');
    html = html.replace(/(<\/ul>)<\/p>/g, '$1');
    html = html.replace(/<p>(<blockquote>)/g, '$1');
    html = html.replace(/(<\/blockquote>)<\/p>/g, '$1');
    html = html.replace(/<p>(<pre>)/g, '$1');
    html = html.replace(/(<\/pre>)<\/p>/g, '$1');
    return html;
  },

  escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  },

  getContent() {
    return document.getElementById('prompt').value;
  }
};

// Workflow controller — manages step-by-step wizard
const workflow = {
  currentStep: 1,
  requestId: null,
  taskData: null,

  init() {
    // Initialize markdown editor
    mdEditor.init();

    // Restore token from localStorage
    const savedToken = localStorage.getItem('actioncode_token');
    if (savedToken) {
      const el = document.getElementById('github-token');
      if (el) el.value = savedToken;
    }

    // Restore recent repo
    const savedRepo = localStorage.getItem('actioncode_repo');
    if (savedRepo) {
      const el = document.getElementById('repo-url');
      if (el) el.value = savedRepo;
    }

    // Character count
    const prompt = document.getElementById('prompt');
    const charCount = document.getElementById('char-count');
    if (prompt && charCount) {
      prompt.addEventListener('input', () => {
        charCount.textContent = `${prompt.value.length} characters`;
      });
    }

    // Form submit
    const form = document.getElementById('trigger-form');
    if (form) form.addEventListener('submit', (e) => this.handleSubmit(e));
  },

  goToStep(step) {
    if (step > this.currentStep + 1) return; // can't skip ahead
    this.setStep(step);
  },

  setStep(step) {
    this.currentStep = step;
    // Update sidebar
    document.querySelectorAll('.step-item').forEach(el => {
      const s = parseInt(el.dataset.step);
      el.classList.remove('active', 'completed');
      if (s === step) el.classList.add('active');
      else if (s < step) el.classList.add('completed');
    });
    // Update panels
    document.querySelectorAll('.step-panel').forEach(el => el.classList.remove('active'));
    const panel = document.getElementById(`panel-${step}`);
    if (panel) panel.classList.add('active');
  },

  async handleSubmit(e) {
    e.preventDefault();
    const token = document.getElementById('github-token').value.trim();
    const repoUrl = document.getElementById('repo-url').value.trim();
    const branch = document.getElementById('branch').value.trim() || 'main';
    const instruction = mdEditor.getContent().trim();

    if (!token || !repoUrl || !instruction) {
      alert('Please fill in all required fields');
      return;
    }

    // Parse repo
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) {
      alert('Invalid GitHub repository URL');
      return;
    }
    const repository = `${match[1]}/${match[2]}`;

    // Save to localStorage
    localStorage.setItem('actioncode_token', token);
    localStorage.setItem('actioncode_repo', repoUrl);

    // Show loading
    const btn = document.getElementById('execute-btn');
    const spinner = document.getElementById('spinner');
    const btnText = document.getElementById('btn-text');
    btn.disabled = true;
    spinner.style.display = 'inline-block';
    btnText.textContent = 'Triggering...';

    try {
      const result = await api.trigger({
        github_token: token,
        repository,
        branch,
        instruction,
      });

      if (result.success && result.request_id) {
        this.requestId = result.request_id;
        this.taskData = { repository, branch, instruction, id: result.request_id };

        // Update status bar
        document.getElementById('status-task-id').textContent = `Task: ${result.request_id.slice(0, 8)}...`;
        document.getElementById('status-branch').textContent = branch;

        // Move to step 2
        this.setStep(2);

        // Start streaming
        stream.connect(result.request_id);

        // Start timer
        this.startTimer();

        // Add to history
        this.addToHistory(result.request_id, instruction);
      } else {
        throw new Error(result.error || 'Failed to trigger');
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      btn.disabled = false;
      spinner.style.display = 'none';
      btnText.textContent = 'Start Agent';
    }
  },

  async runSafetyCheck() {
    const instruction = mdEditor.getContent().trim();
    const safetyLevel = document.getElementById('safety-level').value;

    if (!instruction) {
      alert('Enter an instruction first');
      return;
    }

    const resultsDiv = document.getElementById('safety-results');
    resultsDiv.style.display = 'block';
    resultsDiv.className = 'safety-results';
    resultsDiv.innerHTML = '<div style="color:var(--text-muted)">Running safety check...</div>';

    try {
      const result = await api.safetyCheck(instruction, safetyLevel);
      if (result.success && result.data) {
        const { passed, riskLevel, findings } = result.data;
        resultsDiv.className = `safety-results ${passed ? 'passed' : 'failed'}`;

        let html = `<div style="font-weight:600;margin-bottom:8px">${passed ? '✅ Safety check passed' : '⚠️ Safety concerns found'} <span style="color:var(--text-dim)">(risk: ${riskLevel})</span></div>`;

        if (findings.length > 0) {
          html += findings.map(f => `
            <div class="safety-finding">
              <span class="severity ${f.severity}">${f.severity}</span>
              <span>${f.message}</span>
            </div>
          `).join('');
        }

        resultsDiv.innerHTML = html;
      }
    } catch (error) {
      resultsDiv.className = 'safety-results failed';
      resultsDiv.innerHTML = `<div style="color:var(--error)">Safety check failed: ${error.message}</div>`;
    }
  },

  startTimer() {
    this._timerStart = Date.now();
    const timerEl = document.getElementById('execution-timer');
    const statusDuration = document.getElementById('status-duration');

    this._timerInterval = setInterval(() => {
      const elapsed = Date.now() - this._timerStart;
      const mins = Math.floor(elapsed / 60000);
      const secs = Math.floor((elapsed % 60000) / 1000);
      const str = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      if (timerEl) timerEl.textContent = str;
      if (statusDuration) statusDuration.textContent = str;
    }, 1000);
  },

  stopTimer() {
    if (this._timerInterval) clearInterval(this._timerInterval);
  },

  addToHistory(id, instruction) {
    const container = document.getElementById('task-history');
    const empty = container.querySelector('.task-history-empty');
    if (empty) empty.remove();

    const item = document.createElement('div');
    item.className = 'task-history-item running';
    item.dataset.id = id;
    item.innerHTML = `
      <span class="task-icon">●</span>
      <span class="task-label" title="${instruction}">${instruction.slice(0, 30)}</span>
    `;
    item.onclick = () => this.loadTask(id);
    container.prepend(item);
  },

  updateHistoryStatus(id, status) {
    const item = document.querySelector(`.task-history-item[data-id="${id}"]`);
    if (!item) return;
    item.className = `task-history-item ${status}`;
    const icon = item.querySelector('.task-icon');
    if (status === 'completed') icon.textContent = '✓';
    else if (status === 'failed') icon.textContent = '✗';
  },

  async loadTask(id) {
    try {
      const result = await api.getStatus(id);
      if (result.success && result.data) {
        this.requestId = id;
        this.taskData = result.data;
        document.getElementById('status-task-id').textContent = `Task: ${id.slice(0, 8)}...`;
        document.getElementById('status-branch').textContent = result.data.branch || '';
        // Jump to appropriate step based on status
        const statusStepMap = {
          pending: 2, dispatched: 2, validating: 2,
          running: 3, building: 4, testing: 4, retrying: 3,
          'creating-pr': 5, completed: 6, failed: 6, 'rate-limited': 6,
        };
        this.setStep(statusStepMap[result.data.status] || 2);
        stream.connect(id);
      }
    } catch (error) {
      console.error('Failed to load task:', error);
    }
  },

  getDuration() {
    if (!this._timerStart) return '0s';
    const elapsed = Date.now() - this._timerStart;
    const mins = Math.floor(elapsed / 60000);
    const secs = Math.floor((elapsed % 60000) / 1000);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  },
};

// Export globals
window.mdEditor = mdEditor;
window.workflow = workflow;
