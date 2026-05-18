import { NextResponse } from 'next/server';
import { addClient, removeClient } from '@/lib/sse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  let controller: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      controller = ctrl;
      addClient(ctrl);

      // Send initial heartbeat
      const hb = new TextEncoder().encode(': heartbeat\n\n');
      ctrl.enqueue(hb);
    },
    cancel() {
      removeClient(controller);
    },
  });

  // Keep-alive ping every 25 seconds
  const ping = setInterval(() => {
    try {
      const hb = new TextEncoder().encode(': ping\n\n');
      controller.enqueue(hb);
    } catch {
      clearInterval(ping);
    }
  }, 25_000);

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
