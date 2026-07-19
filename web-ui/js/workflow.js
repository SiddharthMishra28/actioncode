// Workflow controller — manages step-by-step wizard
const workflow = {
  currentStep: 1,
  requestId: null,
  taskData: null,

  init() {
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
    const instruction = document.getElementById('prompt').value.trim();

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
    const instruction = document.getElementById('prompt').value.trim();
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
          running: 3, building: 3, testing: 3, retrying: 3,
          'creating-pr': 4, completed: 5, failed: 5, 'rate-limited': 5,
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
