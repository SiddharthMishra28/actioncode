// API Configuration
const API_CONFIG = {
  // Cloudflare Worker URL — update after deploying the worker
  WORKER_URL: 'https://ezcode.shared-drive-temp.workers.dev',
  // GitHub repository for the actioncode project
  REPO: 'SiddharthMishra28/actioncode',
  // Polling interval in ms
  POLL_INTERVAL: 5000,
};

// API Client
const api = {
  async request(endpoint, options = {}) {
    const url = `${API_CONFIG.WORKER_URL}${endpoint}`;
    const config = {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    };
    try {
      const response = await fetch(url, config);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      return data;
    } catch (error) {
      console.error(`API Error (${endpoint}):`, error);
      throw error;
    }
  },

  // Trigger AI agent
  async trigger(payload) {
    return this.request('/api/trigger', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Get request status
  async getStatus(requestId) {
    return this.request(`/api/status/${requestId}`);
  },

  // Get request logs
  async getLogs(requestId) {
    return this.request(`/api/logs/${requestId}`);
  },

  // Get notifications for a request
  async getNotifications(requestId) {
    return this.request(`/api/notifications/${requestId}`);
  },

  // List recent tasks
  async listTasks(limit = 20, status = null) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (status) params.set('status', status);
    return this.request(`/api/tasks?${params}`);
  },

  // Get resume token data
  async getResumeData(token) {
    return this.request(`/api/resume/${token}`);
  },

  // Health check
  async healthCheck() {
    return this.request('/health');
  },
};

// Polling helper — stops on terminal status
function startStatusPolling(requestId, onUpdate, interval) {
  const pollMs = interval || API_CONFIG.POLL_INTERVAL;
  let timer = null;
  const terminal = ['completed', 'failed', 'rate-limited', 'cancelled'];

  async function poll() {
    try {
      const result = await api.getStatus(requestId);
      if (result.success && result.data) {
        onUpdate(result.data);
        if (terminal.includes(result.data.status)) {
          clearInterval(timer);
          return;
        }
      }
    } catch (err) {
      console.error('Poll error:', err);
    }
  }

  poll();
  timer = setInterval(poll, pollMs);
  return () => clearInterval(timer);
}

// Export for use in other scripts
window.api = api;
window.API_CONFIG = API_CONFIG;
window.startStatusPolling = startStatusPolling;
