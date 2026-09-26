import type { Response } from 'express';

/**
 * Minimal Server-Sent Events writer. Sends a comment heartbeat so proxies keep idle
 * connections open, and becomes a no-op once the connection has closed.
 */
export class SseWriter {
  private readonly heartbeat: NodeJS.Timeout;

  constructor(
    private readonly response: Response,
    heartbeatMs: number,
  ) {
    response.status(200);
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders();

    this.heartbeat = setInterval(() => this.write(': ping\n\n'), heartbeatMs);
    this.heartbeat.unref();
    response.on('close', () => clearInterval(this.heartbeat));
  }

  get isOpen(): boolean {
    return !this.response.writableEnded && !this.response.destroyed;
  }

  send(event: string, data: unknown): void {
    this.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  close(): void {
    clearInterval(this.heartbeat);
    if (this.isOpen) this.response.end();
  }

  private write(chunk: string): void {
    if (this.isOpen) this.response.write(chunk);
  }
}

/** Aborts when the client disconnects before the response finished (not on normal completion). */
export function abortOnClientDisconnect(response: Response): AbortSignal {
  const controller = new AbortController();
  response.on('close', () => {
    if (!response.writableFinished) controller.abort();
  });
  return controller.signal;
}
