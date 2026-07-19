// VSCode-inspired file editor and tree viewer
const editor = {
  files: new Map(),
  activeFile: null,

  switchTab(tab) {
    document.querySelectorAll('.right-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.right-tab[data-tab="${tab}"]`).classList.add('active');
    document.getElementById('files-panel').style.display = tab === 'files' ? 'block' : 'none';
    document.getElementById('editor-panel').style.display = tab === 'editor' ? 'block' : 'none';
    document.getElementById('logs-panel').style.display = tab === 'logs' ? 'block' : 'none';
  },

  updateFileTree(filePaths) {
    const tree = document.getElementById('file-tree');
    if (!filePaths || filePaths.length === 0) {
      tree.innerHTML = '<div class="file-tree-empty">No files yet</div>';
      return;
    }

    // Build tree structure
    const root = {};
    for (const path of filePaths) {
      const parts = path.split('/');
      let current = root;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!current[part]) {
          current[part] = i === parts.length - 1 ? null : {};
        }
        if (current[part] !== null) {
          current = current[part];
        }
      }
    }

    tree.innerHTML = this.renderTree(root, 0);
  },

  renderTree(node, depth) {
    let html = '';
    const entries = Object.entries(node).sort(([a, va], [b, vb]) => {
      // Directories first
      if (va !== null && vb === null) return -1;
      if (va === null && vb !== null) return 1;
      return a.localeCompare(b);
    });

    for (const [name, children] of entries) {
      const isDir = children !== null;
      const icon = isDir ? this.getDirIcon(name) : this.getFileIcon(name);
      const indent = '<span class="tree-indent"></span>'.repeat(depth);

      html += `<div class="tree-item ${isDir ? 'directory' : 'file'}" onclick="${isDir ? '' : `editor.openFile('${name}')`}">
        ${indent}<span class="tree-icon">${icon}</span>
        <span>${name}</span>
      </div>`;

      if (isDir && children) {
        html += `<div class="tree-children">${this.renderTree(children, depth + 1)}</div>`;
      }
    }
    return html;
  },

  getDirIcon(name) {
    const icons = {
      src: '📁', lib: '📁', dist: '📁', build: '📁',
      test: '📁', tests: '📁', __tests__: '📁',
      node_modules: '📦', .git: '📁', config: '⚙️',
    };
    return icons[name] || '📁';
  },

  getFileIcon(name) {
    const ext = name.split('.').pop()?.toLowerCase();
    const icons = {
      ts: '🔷', tsx: '🔷', js: '🟡', jsx: '🟡',
      py: '🐍', rb: '💎', go: '🔵', rs: '🦀',
      java: '☕', html: '🌐', css: '🎨', scss: '🎨',
      json: '📋', yaml: '📋', yml: '📋', toml: '📋',
      md: '📝', txt: '📄', sh: '🖥️',
      sql: '🗃️', graphql: '◈', prisma: '◆',
      dockerfile: '🐳', xml: '📄', svg: '🎨',
      lock: '🔒', env: '🔐',
    };
    return icons[ext] || '📄';
  },

  addFile(path, content) {
    this.files.set(path, content);
    // Update tree
    const paths = Array.from(this.files.keys());
    this.updateFileTree(paths);
  },

  async openFile(path) {
    // Try to get content from local cache first
    let content = this.files.get(path);

    if (!content && workflow.requestId) {
      try {
        const result = await api.getFileContent(workflow.requestId, path);
        if (result.success && result.data) {
          content = result.data.content;
          this.files.set(path, content);
        }
      } catch {}
    }

    if (!content) {
      content = '// Loading...';
    }

    this.activeFile = path;
    this.renderEditor(path, content);
    this.switchTab('editor');
  },

  renderEditor(path, content) {
    const header = document.getElementById('editor-header');
    const body = document.getElementById('editor-body');

    header.innerHTML = `<span class="editor-filename">${path}</span>`;

    const lines = content.split('\n');
    body.innerHTML = `<div class="editor-content">${
      lines.map((line, i) => `
        <div class="editor-line">
          <span class="editor-line-num">${i + 1}</span>
          <span class="editor-line-text">${this.highlightLine(line, path)}</span>
        </div>`
      ).join('')
    }</div>`;
  },

  highlightLine(line, path) {
    const ext = path.split('.').pop()?.toLowerCase();
    // Basic syntax highlighting
    let html = this.escapeHtml(line);

    // Comments
    if (ext === 'ts' || ext === 'js' || ext === 'tsx' || ext === 'jsx') {
      html = html.replace(/(\/\/.*$)/gm, '<span style="color:#6e7681">$1</span>');
      html = html.replace(/(\/\*[\s\S]*?\*\/)/g, '<span style="color:#6e7681">$1</span>');
      // Keywords
      html = html.replace(/\b(import|export|from|const|let|var|function|return|if|else|for|while|class|extends|new|async|await|try|catch|throw)\b/g,
        '<span style="color:#ff7b72">$1</span>');
      // Strings
      html = html.replace(/(&#39;[^&#39;]*&#39;|&quot;[^&quot;]*&quot;|`[^`]*`)/g,
        '<span style="color:#a5d6ff">$1</span>');
      // Numbers
      html = html.replace(/\b(\d+)\b/g, '<span style="color:#79c0ff">$1</span>');
    } else if (ext === 'py') {
      html = html.replace(/(#.*$)/gm, '<span style="color:#6e7681">$1</span>');
      html = html.replace(/\b(def|class|import|from|return|if|else|for|while|try|except|with|as|lambda|True|False|None)\b/g,
        '<span style="color:#ff7b72">$1</span>');
    } else if (ext === 'md') {
      if (html.startsWith('##')) html = `<span style="color:#f0883e;font-weight:600">${html}</span>`;
      else if (html.startsWith('#')) html = `<span style="color:#f0883e;font-weight:700">${html}</span>`;
    } else if (ext === 'json') {
      html = html.replace(/(&quot;[^&quot;]*&quot;)\s*:/g, '<span style="color:#7ee787">$1</span>:');
    }

    return html;
  },

  escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  // Load files from API
  async loadFiles(requestId) {
    try {
      const result = await api.getFiles(requestId);
      if (result.success && result.data && result.data.files) {
        const flatFiles = this.flattenTree(result.data.files);
        for (const { path, content } of flatFiles) {
          this.files.set(path, content || '');
        }
        this.updateFileTree(flatFiles.map(f => f.path));
      }
    } catch {}
  },

  flattenTree(nodes, prefix = '') {
    const result = [];
    for (const node of nodes) {
      const fullPath = prefix ? `${prefix}/${node.name}` : node.name;
      if (node.type === 'file') {
        result.push({ path: fullPath, content: '' });
      } else if (node.children) {
        result.push(...this.flattenTree(node.children, fullPath));
      }
    }
    return result;
  },
};
