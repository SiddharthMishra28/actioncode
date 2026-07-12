// API Configuration
const API_CONFIG = {
  // Update this with your Cloudflare Worker URL
  WORKER_URL: 'https://ezcode.shared-drive-temp.workers.dev',
  
  // GitHub repository for the actioncode project
  REPO: 'SiddharthMishra28/actioncode',
};

// API Client
const api = {
  // Make API request
  async request(endpoint, options = {}) {
    const url = `${API_CONFIG.WORKER_URL}${endpoint}`;
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
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
  
  // Get resume token data
  async getResumeData(token) {
    return this.request(`/api/resume/${token}`);
  },
  
  // Health check
  async healthCheck() {
    return this.request('/health');
  },
};

// Export for use in other scripts
window.api = api;
window.API_CONFIG = API_CONFIG;
