// Status page logic
let requestId = null;
let resumeToken = null;
let pollInterval = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  requestId = urlParams.get('id');
  resumeToken = urlParams.get('resume');
  
  if (requestId) {
    loadStatus();
    startPolling();
  } else if (resumeToken) {
    loadResumeData();
  } else {
    showError('No request ID provided');
  }
});

// Load status data
async function loadStatus() {
  if (!requestId) return;
  
  try {
    const result = await api.getStatus(requestId);
    
    if (result.success && result.data) {
      updateUI(result.data);
    } else {
      showError(result.error || 'Failed to load status');
    }
  } catch (error) {
    showError(error.message);
  }
}

// Load resume data
async function loadResumeData() {
  if (!resumeToken) return;
  
  try {
    const result = await api.getResumeData(resumeToken);
    
    if (result.success && result.data) {
      showResumeInfo(result.data);
    } else {
      showError(result.error || 'Invalid resume token');
    }
  } catch (error) {
    showError(error.message);
  }
}

// Update UI with status data
function updateUI(data) {
  // Update status badge
  const badge = document.getElementById('status-badge');
  badge.textContent = data.status;
  badge.className = `badge ${data.status}`;
  
  // Update request info
  document.getElementById('request-id').textContent = data.id || '-';
  document.getElementById('repository').textContent = data.repository || '-';
  document.getElementById('branch').textContent = data.branch || '-';
  document.getElementById('created-at').textContent = data.createdAt 
    ? new Date(data.createdAt).toLocaleString() 
    : '-';
  
  // Update progress steps
  updateProgressSteps(data.status);
  
  // Handle terminal states
  if (data.status === 'completed') {
    showCompleted(data);
    stopPolling();
  } else if (data.status === 'failed') {
    showError(data.errorMessage || 'Request failed');
    stopPolling();
  } else if (data.status === 'rate-limited') {
    showRateLimit(data);
    stopPolling();
  }
  
  // Load logs
  loadLogs();
}

// Update progress steps
function updateProgressSteps(status) {
  const steps = document.querySelectorAll('.step');
  const statusOrder = [
    'pending', 'validating', 'dispatched', 'running', 
    'building', 'testing', 'creating-pr', 'completed'
  ];
  
  const currentIndex = statusOrder.indexOf(status);
  
  steps.forEach((step, index) => {
    const stepStatus = step.dataset.step;
    const stepIndex = statusOrder.indexOf(stepStatus);
    
    step.classList.remove('active', 'completed');
    
    if (stepIndex < currentIndex) {
      step.classList.add('completed');
    } else if (stepIndex === currentIndex) {
      step.classList.add('active');
    }
  });
}

// Show completed state
function showCompleted(data) {
  const resultSection = document.getElementById('result-section');
  const prLink = document.getElementById('pr-link');
  
  resultSection.style.display = 'block';
  
  if (data.prUrl) {
    prLink.style.display = 'block';
    document.getElementById('pr-url').href = data.prUrl;
  }
}

// Show error state
function showError(message) {
  const resultSection = document.getElementById('result-section');
  const errorMessage = document.getElementById('error-message');
  const errorText = document.getElementById('error-text');
  
  resultSection.style.display = 'block';
  errorMessage.style.display = 'block';
  errorText.textContent = message;
}

// Show rate limit state
function showRateLimit(data) {
  const rateLimitSection = document.getElementById('rate-limit-section');
  const resumeTokenDisplay = document.getElementById('resume-token-display');
  
  rateLimitSection.style.display = 'block';
  resumeTokenDisplay.textContent = data.resumeToken || resumeToken || '-';
}

// Show resume info
function showResumeInfo(data) {
  const statusCard = document.getElementById('status-card');
  
  statusCard.innerHTML = `
    <h2>Resume Information</h2>
    <div class="request-info">
      <div class="info-row">
        <span class="label">Original Request:</span>
        <span class="value">${data.requestId || '-'}</span>
      </div>
      <div class="info-row">
        <span class="label">Branch:</span>
        <span class="value">${data.branch || '-'}</span>
      </div>
      <div class="info-row">
        <span class="label">Completed Steps:</span>
        <span class="value">${(data.completedSteps || []).join(', ') || '-'}</span>
      </div>
      <div class="info-row">
        <span class="label">Expires:</span>
        <span class="value">${data.expiresAt ? new Date(data.expiresAt).toLocaleString() : '-'}</span>
      </div>
    </div>
    <div style="margin-top: 1.5rem;">
      <h3>Remaining Instruction</h3>
      <p style="margin-top: 0.5rem; color: var(--text-muted);">${data.remainingInstruction || '-'}</p>
    </div>
    <div style="margin-top: 1.5rem;">
      <a href="/" class="btn-primary" style="display: inline-flex;">Start New Request</a>
    </div>
  `;
}

// Load logs
async function loadLogs() {
  if (!requestId) return;
  
  try {
    const result = await api.getLogs(requestId);
    
    if (result.success && result.data && result.data.lines) {
      updateLogs(result.data.lines);
    }
  } catch (error) {
    console.error('Failed to load logs:', error);
  }
}

// Update logs display
function updateLogs(lines) {
  const logsContainer = document.getElementById('logs-container');
  
  if (lines.length === 0) {
    logsContainer.innerHTML = '<span class="log-placeholder">No logs yet...</span>';
    return;
  }
  
  logsContainer.textContent = lines.join('\n');
  logsContainer.scrollTop = logsContainer.scrollHeight;
}

// Clear logs
function clearLogs() {
  const logsContainer = document.getElementById('logs-container');
  logsContainer.innerHTML = '<span class="log-placeholder">Logs cleared</span>';
}

// Start polling for updates
function startPolling() {
  pollInterval = setInterval(() => {
    loadStatus();
  }, 5000); // Poll every 5 seconds
}

// Stop polling
function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

// Copy resume token to clipboard
function copyResumeToken() {
  const token = document.getElementById('resume-token-display').textContent;
  navigator.clipboard.writeText(token).then(() => {
    alert('Resume token copied to clipboard!');
  });
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  stopPolling();
});
