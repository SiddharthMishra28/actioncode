// File listing and content handler for VSCode-style file viewer
import type { Env } from '../types';

export interface FileEntry {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size?: number;
  language?: string;
  children?: FileEntry[];
}

// Store files for a task
export async function storeFiles(
  env: Env,
  requestId: string,
  files: Record<string, string>
): Promise<void> {
  const key = `files:${requestId}`;
  // Store as array of { path, content } for KV efficiency
  const entries = Object.entries(files).map(([path, content]) => ({
    path,
    content,
    size: content.length,
  }));
  await env.ACTIONCODE_KV.put(key, JSON.stringify(entries), { expirationTtl: 7 * 24 * 60 * 60 });
}

// Get file tree for a task
export async function getFileTree(env: Env, requestId: string): Promise<FileEntry[]> {
  const key = `files:${requestId}`;
  const entries = await env.ACTIONCODE_KV.get<Array<{ path: string; content: string; size: number }>>(key, 'json');

  if (!entries) return [];

  // Build tree structure
  const root: FileEntry[] = [];
  const dirMap = new Map<string, FileEntry>();

  for (const entry of entries.sort((a, b) => a.path.localeCompare(b.path))) {
    const parts = entry.path.split('/');
    let current = root;

    // Create directory structure
    for (let i = 0; i < parts.length - 1; i++) {
      const dirPath = parts.slice(0, i + 1).join('/');
      let dir = dirMap.get(dirPath);
      if (!dir) {
        dir = {
          path: dirPath,
          name: parts[i],
          type: 'directory',
          children: [],
        };
        dirMap.set(dirPath, dir);
        current.push(dir);
      }
      current = dir.children!;
    }

    // Add file
    const fileName = parts[parts.length - 1];
    current.push({
      path: entry.path,
      name: fileName,
      type: 'file',
      size: entry.size,
      language: getLanguage(fileName),
    });
  }

  return root;
}

// Get file content
export async function getFileContent(
  env: Env,
  requestId: string,
  filePath: string
): Promise<string | null> {
  const key = `files:${requestId}`;
  const entries = await env.ACTIONCODE_KV.get<Array<{ path: string; content: string }>>(key, 'json');

  if (!entries) return null;

  const entry = entries.find(e => e.path === filePath);
  return entry?.content || null;
}

// Get file language from extension
function getLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    ts: 'typescript', tsx: 'typescriptreact', js: 'javascript', jsx: 'javascriptreact',
    py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
    html: 'html', css: 'css', scss: 'scss', less: 'less',
    json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'toml',
    md: 'markdown', txt: 'text', sh: 'bash', bash: 'bash',
    sql: 'sql', graphql: 'graphql', prisma: 'prisma',
    dockerfile: 'dockerfile', xml: 'xml', svg: 'svg',
    php: 'php', swift: 'swift', kt: 'kotlin', c: 'c', cpp: 'cpp',
  };
  return langMap[ext] || 'text';
}

// API endpoint: list files
export async function handleFilesList(
  env: Env,
  requestId: string
): Promise<Response> {
  const tree = await getFileTree(env, requestId);
  return new Response(JSON.stringify({ success: true, data: { files: tree } }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

// API endpoint: get file content
export async function handleFileContent(
  env: Env,
  requestId: string,
  filePath: string
): Promise<Response> {
  const content = await getFileContent(env, requestId, filePath);
  if (content === null) {
    return new Response(JSON.stringify({ error: 'File not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(JSON.stringify({ success: true, data: { path: filePath, content } }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
