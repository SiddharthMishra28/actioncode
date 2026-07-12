import type { Env, TelegramUpdate } from '../types';

// Send a message via Telegram Bot API
export async function sendTelegramMessage(
  env: Env,
  chatId: string,
  text: string,
  options: {
    parse_mode?: 'Markdown' | 'HTML';
    reply_to_message_id?: number;
  } = {}
): Promise<boolean> {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: options.parse_mode || 'HTML',
  };
  
  if (options.reply_to_message_id) {
    body.reply_to_message_id = options.reply_to_message_id;
  }
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    
    const result = await response.json() as { ok: boolean };
    return result.ok;
  } catch (error) {
    console.error('Failed to send Telegram message:', error);
    return false;
  }
}

// Send a progress update
export async function sendProgressUpdate(
  env: Env,
  chatId: string,
  status: string,
  details?: string
): Promise<void> {
  const messages: Record<string, string> = {
    pending: '⏳ Request Pending',
    validating: '🔍 Validating Request',
    dispatched: '📤 Request Dispatched',
    running: '🏃 Execution Started',
    building: '🔨 Building',
    testing: '🧪 Running Tests',
    retrying: '♻️ Retrying Build',
    'creating-pr': '🚀 Creating Pull Request',
    completed: '✅ Completed',
    failed: '❌ Failed',
    'rate-limited': '⚠️ Rate Limit Hit',
    cancelled: '🚫 Cancelled',
  };
  
  let message = messages[status] || 'Unknown status';
  if (details) {
    message += `\n\n${details}`;
  }
  
  await sendTelegramMessage(env, chatId, message);
}

// Send a completion message
export async function sendCompletionMessage(
  env: Env,
  chatId: string,
  result: {
    repository: string;
    branch: string;
    prUrl?: string;
    commitSha?: string;
    filesChanged?: number;
    duration: string;
  }
): Promise<void> {
  const message = [
    '<b>Request Complete</b>',
    '',
    `Repository: <code>${result.repository}</code>`,
    `Branch: <code>${result.branch}</code>`,
    result.commitSha ? `Commit: <code>${result.commitSha}</code>` : '',
    `Files Modified: ${result.filesChanged || 0}`,
    result.prUrl ? `PR: <a href="${result.prUrl}">View Pull Request</a>` : '',
    `Execution Time: ${result.duration}`,
  ].filter(Boolean).join('\n');
  
  await sendTelegramMessage(env, chatId, message, { parse_mode: 'HTML' });
}

// Send a failure message
export async function sendFailureMessage(
  env: Env,
  chatId: string,
  error: {
    reason: string;
    workflowUrl?: string;
    modifiedFiles?: string[];
  }
): Promise<void> {
  const message = [
    '<b>Request Failed</b>',
    '',
    `Reason: ${error.reason}`,
    '',
    error.modifiedFiles && error.modifiedFiles.length > 0 
      ? `Modified Files:\n${error.modifiedFiles.map(f => `- <code>${f}</code>`).join('\n')}` 
      : '',
    error.workflowUrl ? `\nWorkflow: <a href="${error.workflowUrl}">View Logs</a>` : '',
  ].filter(Boolean).join('\n');
  
  await sendTelegramMessage(env, chatId, message, { parse_mode: 'HTML' });
}

// Send a rate limit message with resume token
export async function sendRateLimitMessage(
  env: Env,
  chatId: string,
  resumeToken: string
): Promise<void> {
  const message = [
    '<b>Rate Limit Hit</b>',
    '',
    'OpenCode free model rate limit exceeded.',
    'Your progress has been saved.',
    '',
    `<b>Resume Token:</b> <code>${resumeToken}</code>`,
    '<b>Expires:</b> 12 hours',
    '',
    'To resume via Telegram:',
    `/resume ${resumeToken}`,
    '',
    'To resume via web UI:',
    'Visit ezcode.github.io and use this token',
  ].filter(Boolean).join('\n');
  
  await sendTelegramMessage(env, chatId, message, { parse_mode: 'HTML' });
}

// Set webhook for Telegram
export async function setTelegramWebhook(
  env: Env,
  webhookUrl: string
): Promise<boolean> {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: env.WEBHOOK_SECRET,
      }),
    });
    
    const result = await response.json() as { ok: boolean };
    return result.ok;
  } catch (error) {
    console.error('Failed to set Telegram webhook:', error);
    return false;
  }
}
