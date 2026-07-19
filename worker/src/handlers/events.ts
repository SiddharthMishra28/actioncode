// Server-Sent Events handler for real-time task updates
import type { Env } from '../types';

export interface TaskEvent {
  type: 'role-start' | 'role-complete' | 'thought' | 'code-change' | 'file-create' | 'status-update' | 'summary' | 'error';
  timestamp: string;
  data: Record<string, unknown>;
}

// Store an event for a task
export async function appendEvent(env: Env, requestId: string, event: TaskEvent): Promise<void> {
  const key = `events:${requestId}`;
  const existing = await env.ACTIONCODE_KV.get<TaskEvent[]>(key, 'json');
  const events = existing || [];
  events.push(event);
  // Keep last 500 events
  const trimmed = events.slice(-500);
  await env.ACTIONCODE_KV.put(key, JSON.stringify(trimmed), { expirationTtl: 7 * 24 * 60 * 60 });
}

// Get all events for a task
export async function getEvents(env: Env, requestId: string): Promise<TaskEvent[]> {
  const events = await env.ACTIONCODE_KV.get<TaskEvent[]>(`events:${requestId}`, 'json');
  return events || [];
}

// SSE endpoint — streams events as they arrive
export async function handleEventsStream(
  request: Request,
  env: Env,
  requestId: string
): Promise<Response> {
  // Get existing events first
  const existingEvents = await getEvents(env, requestId);
  const terminalStatuses = ['completed', 'failed', 'rate-limited', 'cancelled'];
  const lastEvent = existingEvents[existingEvents.length - 1];
  const isTerminal = lastEvent?.type === 'status-update' &&
    terminalStatuses.includes(lastEvent.data.status as string);

  // Build initial SSE payload from existing events
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;

  const stream = new ReadableStream({
    start(ctrl) {
      controller = ctrl;

      // Send existing events
      for (const event of existingEvents) {
        ctrl.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      // If terminal, close immediately
      if (isTerminal) {
        ctrl.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'stream-end', timestamp: new Date().toISOString() })}\n\n`));
        ctrl.close();
      }
    },
  });

  // If not terminal, set up polling
  if (!isTerminal) {
    let eventIndex = existingEvents.length;
    let closed = false;

    const pollInterval = setInterval(async () => {
      if (closed) {
        clearInterval(pollInterval);
        return;
      }

      try {
        const currentEvents = await getEvents(env, requestId);
        // Send new events
        while (eventIndex < currentEvents.length) {
          const event = currentEvents[eventIndex];
          controller?.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));

          // Check if terminal
          if (event.type === 'status-update' && terminalStatuses.includes(event.data.status as string)) {
            controller?.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'stream-end', timestamp: new Date().toISOString() })}\n\n`));
            controller?.close();
            closed = true;
            clearInterval(pollInterval);
            return;
          }
          eventIndex++;
        }
      } catch {
        // KV read error — continue polling
      }
    }, 2000);

    // Clean up on client disconnect
    request.signal?.addEventListener('abort', () => {
      closed = true;
      clearInterval(pollInterval);
      controller?.close();
    });
  }

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// API endpoint to post events (called from GitHub Actions workflow)
export async function handleEventPost(
  request: Request,
  env: Env
): Promise<Response> {
  let body: { request_id: string; event: TaskEvent };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { request_id, event } = body;
  if (!request_id || !event) {
    return new Response(JSON.stringify({ error: 'Missing request_id or event' }), { status: 400 });
  }

  await appendEvent(env, request_id, event);

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
