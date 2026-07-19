// Form handling
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('trigger-form');
  const resumeForm = document.getElementById('resume-form');
  const promptTextarea = document.getElementById('prompt');
  const charCount = document.getElementById('char-count');
  
  // Character count
  if (promptTextarea && charCount) {
    promptTextarea.addEventListener('input', () => {
      charCount.textContent = `${promptTextarea.value.length} characters`;
    });
  }
  
  // Main form submission
  if (form) {
    form.addEventListener('submit', handleSubmit);
  }
  
  // Resume form submission
  if (resumeForm) {
    resumeForm.addEventListener('submit', handleResume);
  }
  
  // Check for resume token in URL
  const urlParams = new URLSearchParams(window.location.search);
  const resumeToken = urlParams.get('resume');
  if (resumeToken) {
    document.getElementById('resume-section').style.display = 'block';
    document.getElementById('resume-token').value = resumeToken;
  }
});

// Handle form submission
async function handleSubmit(e) {
  e.preventDefault();
  
  const githubToken = document.getElementById('github-token').value.trim();
  const repoUrl = document.getElementById('repo-url').value.trim();
  const branch = document.getElementById('branch').value.trim() || 'main';
  const prompt = document.getElementById('prompt').value.trim();
  
  // Validate inputs
  if (!githubToken || !repoUrl || !prompt) {
    alert('Please fill in all required fields');
    return;
  }
  
  // Parse repository from URL
  const repoMatch = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!repoMatch) {
    alert('Invalid GitHub repository URL. Please enter a valid URL like: https://github.com/user/repo');
    return;
  }
  
  const repository = `${repoMatch[1]}/${repoMatch[2]}`;
  
  // Show loading state
  const btn = document.getElementById('execute-btn');
  const spinner = document.getElementById('spinner');
  const btnText = document.getElementById('btn-text');
  
  btn.disabled = true;
  spinner.style.display = 'inline-block';
  btnText.textContent = 'Triggering...';
  
  try {
    const result = await api.trigger({
      github_token: githubToken,
      repository,
      branch,
      instruction: prompt,
    });
    
    if (result.success && result.request_id) {
      // Redirect to status page — use relative path from current location
      const base = window.location.pathname.replace(/\/[^/]*$/, '/');
      window.location.href = `${base}status.html?id=${result.request_id}`;
    } else {
      throw new Error(result.error || 'Failed to trigger pipeline');
    }
  } catch (error) {
    alert(`Error: ${error.message}`);
    btn.disabled = false;
    spinner.style.display = 'none';
    btnText.textContent = 'Execute';
  }
}

// Handle resume form submission
async function handleResume(e) {
  e.preventDefault();
  
  const token = document.getElementById('resume-token').value.trim();
  
  if (!token) {
    alert('Please enter a resume token');
    return;
  }
  
  try {
    const result = await api.getResumeData(token);
    
    if (result.success && result.data) {
      // Redirect to status page with resume data
      const base = window.location.pathname.replace(/\/[^/]*$/, '/');
      window.location.href = `${base}status.html?resume=${token}`;
    } else {
      throw new Error(result.error || 'Invalid resume token');
    }
  } catch (error) {
    alert(`Error: ${error.message}`);
  }
}

// Toggle preview
function togglePreview() {
  const textarea = document.getElementById('prompt');
  const preview = document.getElementById('preview');
  
  if (preview.style.display === 'none') {
    preview.textContent = textarea.value || '(empty)';
    preview.style.display = 'block';
    textarea.style.display = 'none';
  } else {
    preview.style.display = 'none';
    textarea.style.display = 'block';
  }
}

// Copy resume token to clipboard
function copyResumeToken() {
  const token = document.getElementById('resume-token-display').textContent;
  navigator.clipboard.writeText(token).then(() => {
    alert('Resume token copied to clipboard!');
  });
}
