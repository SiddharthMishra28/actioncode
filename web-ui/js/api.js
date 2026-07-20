// API Configuration & Client
const API_CONFIG = {
  WORKER_URL: 'https://ezcode.shared-drive-temp.workers.dev',
  REPO: 'SiddharthMishra28/actioncode',
  POLL_INTERVAL: 5000,
};

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

  async trigger(payload) {
    return this.request('/api/trigger', { method: 'POST', body: JSON.stringify(payload) });
  },

  async getStatus(requestId) {
    return this.request(`/api/status/${requestId}`);
  },

  async getLogs(requestId) {
    return this.request(`/api/logs/${requestId}`);
  },

  async getNotifications(requestId) {
    return this.request(`/api/notifications/${requestId}`);
  },

  async getEvents(requestId) {
    return this.request(`/api/events/${requestId}/json`);
  },

  async getFiles(requestId) {
    return this.request(`/api/files/${requestId}`);
  },

  async getFileContent(requestId, filePath) {
    return this.request(`/api/files/${requestId}/content?path=${encodeURIComponent(filePath)}`);
  },

  async safetyCheck(instruction, safetyLevel) {
    return this.request('/api/safety-check', {
      method: 'POST',
      body: JSON.stringify({ instruction, safetyLevel }),
    });
  },

  async listTasks(limit = 20, status = null) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (status) params.set('status', status);
    return this.request(`/api/tasks?${params}`);
  },

  async getResumeData(token) {
    return this.request(`/api/resume/${token}`);
  },

  async healthCheck() {
    return this.request('/health');
  },
};

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

window.api = api;
window.API_CONFIG = API_CONFIG;
window.startStatusPolling = startStatusPolling;
