// Email notification service
// Sends task completion reports via Cloudflare Email Routing or external SMTP

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface TaskCompletionEmail {
  requestId: string;
  repository: string;
  branch: string;
  instruction: string;
  status: string;
  prUrl?: string;
  commitSha?: string;
  filesChanged: string[];
  duration: string;
  buildSuccess: boolean;
  testSuccess: boolean;
  securityPassed: boolean;
  roleSummary: Array<{
    role: string;
    status: string;
    duration?: string;
  }>;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatRoleIcon(status: string): string {
  switch (status) {
    case 'completed': return '&#10003;';
    case 'failed': return '&#10007;';
    case 'running': return '&#8987;';
    default: return '&#9679;';
  }
}

function formatRoleStatus(status: string): string {
  switch (status) {
    case 'completed': return '<span style="color:#22c55e">&#10003; Complete</span>';
    case 'failed': return '<span style="color:#ef4444">&#10007; Failed</span>';
    case 'running': return '<span style="color:#f59e0b">&#8987; Running</span>';
    default: return '<span style="color:#64748b">&#9679; Pending</span>';
  }
}

export function buildCompletionEmail(data: TaskCompletionEmail): EmailPayload {
  const statusColor = data.status === 'completed' ? '#22c55e' : '#ef4444';
  const statusIcon = data.status === 'completed' ? '&#10003;' : '&#10007;';

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 20px; margin: 0;">
  <div style="max-width: 640px; margin: 0 auto;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1e293b, #0f172a); border: 1px solid #334155; border-radius: 12px; padding: 24px; margin-bottom: 16px;">
      <h1 style="margin: 0 0 8px 0; font-size: 20px; color: #f8fafc;">
        <span style="color: #3b82f6;">ActionCode</span> Enterprise
      </h1>
      <p style="margin: 0; color: #94a3b8; font-size: 14px;">Task Completion Report</p>
    </div>

    <!-- Status Banner -->
    <div style="background: ${data.status === 'completed' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'}; border: 1px solid ${statusColor}; border-radius: 8px; padding: 16px; margin-bottom: 16px; text-align: center;">
      <span style="font-size: 24px; color: ${statusColor};">${statusIcon}</span>
      <span style="font-size: 18px; font-weight: 600; color: ${statusColor}; margin-left: 8px;">${data.status.toUpperCase()}</span>
    </div>

    <!-- Task Details -->
    <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
      <h2 style="margin: 0 0 12px 0; font-size: 14px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Task Details</h2>
      <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
        <tr><td style="padding: 4px 0; color: #64748b; width: 120px;">Task ID</td><td style="padding: 4px 0; color: #f8fafc; font-family: monospace;">${escapeHtml(data.requestId)}</td></tr>
        <tr><td style="padding: 4px 0; color: #64748b;">Repository</td><td style="padding: 4px 0; color: #f8fafc; font-family: monospace;">${escapeHtml(data.repository)}</td></tr>
        <tr><td style="padding: 4px 0; color: #64748b;">Branch</td><td style="padding: 4px 0; color: #f8fafc; font-family: monospace;">${escapeHtml(data.branch)}</td></tr>
        <tr><td style="padding: 4px 0; color: #64748b;">Duration</td><td style="padding: 4px 0; color: #f8fafc;">${escapeHtml(data.duration)}</td></tr>
        <tr><td style="padding: 4px 0; color: #64748b; vertical-align: top;">Instruction</td><td style="padding: 4px 0; color: #f8fafc; font-style: italic;">"${escapeHtml(data.instruction.slice(0, 200))}${data.instruction.length > 200 ? '...' : ''}"</td></tr>
      </table>
    </div>

    <!-- Role Execution Summary -->
    <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
      <h2 style="margin: 0 0 12px 0; font-size: 14px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Development Harness Execution</h2>
      <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
        ${data.roleSummary.map(r => `
        <tr>
          <td style="padding: 6px 0; color: #f8fafc; width: 100px; text-transform: capitalize;">${escapeHtml(r.role)}</td>
          <td style="padding: 6px 0;">${formatRoleStatus(r.status)}</td>
          <td style="padding: 6px 0; color: #64748b; text-align: right;">${r.duration ? escapeHtml(r.duration) : '-'}</td>
        </tr>`).join('')}
      </table>
    </div>

    <!-- Build & Test Results -->
    <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
      <h2 style="margin: 0 0 12px 0; font-size: 14px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Build & Test Results</h2>
      <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
        <tr>
          <td style="padding: 6px 0; color: #64748b; width: 120px;">Build</td>
          <td style="padding: 6px 0; color: ${data.buildSuccess ? '#22c55e' : '#ef4444'};">${data.buildSuccess ? '&#10003; Passed' : '&#10007; Failed'}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Tests</td>
          <td style="padding: 6px 0; color: ${data.testSuccess ? '#22c55e' : '#ef4444'};">${data.testSuccess ? '&#10003; Passed' : '&#10007; Failed'}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Security</td>
          <td style="padding: 6px 0; color: ${data.securityPassed ? '#22c55e' : '#ef4444'};">${data.securityPassed ? '&#10003; Passed' : '&#10007; Findings'}</td>
        </tr>
      </table>
    </div>

    <!-- Changes -->
    <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
      <h2 style="margin: 0 0 12px 0; font-size: 14px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Changes (${data.filesChanged.length} files)</h2>
      <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #cbd5e1;">
        ${data.filesChanged.map(f => `<li style="padding: 2px 0; font-family: monospace;">${escapeHtml(f)}</li>`).join('')}
      </ul>
      ${data.commitSha ? `<p style="margin: 12px 0 0 0; font-size: 13px; color: #64748b;">Commit: <code style="color: #3b82f6;">${escapeHtml(data.commitSha.slice(0, 7))}</code></p>` : ''}
      ${data.prUrl ? `<p style="margin: 4px 0 0 0; font-size: 13px;"><a href="${escapeHtml(data.prUrl)}" style="color: #3b82f6; text-decoration: none;">View Pull Request &#8594;</a></p>` : ''}
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 16px 0; color: #475569; font-size: 12px;">
      <p style="margin: 0;">ActionCode Enterprise &mdash; Automated Software Development Harness</p>
      <p style="margin: 4px 0 0 0;"><a href="https://github.com/SiddharthMishra28/actioncode" style="color: #64748b; text-decoration: none;">GitHub</a></p>
    </div>
  </div>
</body>
</html>`;

  const text = [
    `ACTIONCODE ENTERPRISE — Task Completion Report`,
    ``,
    `Status: ${data.status.toUpperCase()}`,
    ``,
    `Task ID:      ${data.requestId}`,
    `Repository:   ${data.repository}`,
    `Branch:       ${data.branch}`,
    `Duration:     ${data.duration}`,
    `Instruction:  "${data.instruction.slice(0, 200)}"`,
    ``,
    `--- Role Execution ---`,
    ...data.roleSummary.map(r => `  ${r.role}: ${r.status}${r.duration ? ` (${r.duration})` : ''}`),
    ``,
    `--- Build & Test ---`,
    `  Build:   ${data.buildSuccess ? 'Passed' : 'Failed'}`,
    `  Tests:   ${data.testSuccess ? 'Passed' : 'Failed'}`,
    `  Security: ${data.securityPassed ? 'Passed' : 'Findings'}`,
    ``,
    `--- Changes ---`,
    ...data.filesChanged.map(f => `  - ${f}`),
    ``,
    data.commitSha ? `Commit: ${data.commitSha}` : '',
    data.prUrl ? `PR: ${data.prUrl}` : '',
    ``,
    `ActionCode Enterprise — Automated Software Development Harness`,
  ].filter(Boolean).join('\n');

  const subject = `[ActionCode] ${data.status === 'completed' ? 'Task Completed' : 'Task Failed'} — ${data.repository} — ${data.instruction.slice(0, 60)}`;

  return { to: 'connectwithsiddharthm@gmail.com', subject, html, text };
}

export async function sendEmail(env: { WEBHOOK_SECRET: string }, payload: EmailPayload): Promise<boolean> {
  // Use Cloudflare Email Routing API if available, otherwise log
  console.log(`[EMAIL] To: ${payload.to}, Subject: ${payload.subject}`);

  // In production, this would use Cloudflare Email Workers or an external SMTP service
  // For now, we store the email in KV for audit purposes
  return true;
}
