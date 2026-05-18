'use client';

import { useEffect, useState } from 'react';

// let webhookCallCount = 0; // track same idempotency key in memory (for test)

export default function TestToolsPage() {
  const [log, setLog] = useState<string[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  const addLog = (msg: string) => setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

  // ── Reset quota (idempotent webhook) ──────────────────────────────────────
  // const [idemKey] = useState(() => `key_${Date.now()}_reset`);
  const [idemKey, setIdemKey] = useState("");
  const [mounted, setMounted] = useState(false);
  const [callCount, setCallCount] = useState(0);

  useEffect(() => {
    setMounted(true);
    setIdemKey(`_${Date.now()}_reset`);
  }, []);

  const callWebhook = async () => {
    setLoading('webhook');
    const res = await fetch('/api/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idemKey, // same key every time → idempotent
      },
      body: JSON.stringify({ action: 'reset_quota' }),
    });
    const data = await res.json();
    setCallCount((c) => c + 1);
    addLog(`Webhook call #${callCount + 1} → status: ${data.status} (key: ${idemKey.slice(-12)})`);
    setLoading(null);
  };

  // ── Generate 10 concurrent leads ──────────────────────────────────────────
  const generateLeads = async () => {
    setLoading('leads');
    addLog('Generating 10 leads concurrently…');
    const res = await fetch('/api/test-tools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: 10 }),
    });
    const data = await res.json();
    addLog(`Done: ${data.success} succeeded, ${data.failed} failed (duplicate or quota)`);
    setLoading(null);
  };

  // ── New idempotency key (fresh webhook) ────────────────────────────────────
  const [freshCallCount, setFreshCallCount] = useState(0);
  const callFreshWebhook = async () => {
    setLoading('fresh');
    const key = `key_${Date.now()}_fresh_${Math.random()}`;
    const res = await fetch('/api/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': key,
      },
      body: JSON.stringify({ action: 'reset_quota' }),
    });
    const data = await res.json();
    setFreshCallCount((c) => c + 1);
    addLog(`Fresh webhook → status: ${data.status}`);
    setLoading(null);
  };

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-6 font-mono">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="inline-block bg-yellow-500/10 text-yellow-400 text-xs px-3 py-1 rounded-full border border-yellow-700/30 mb-3">
            ⚠ INTERNAL TEST PANEL — NOT FOR USERS
          </div>
          <h1 className="text-xl font-bold">Test Tools</h1>
          <p className="text-xs text-gray-500 mt-1">
            Simulate payment webhooks, test idempotency, and generate concurrent load.
          </p>
        </div>

        <div className="grid gap-4">
          {/* Card: Reset Quota (Idempotent) */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-sm font-bold mb-1">🔁 Idempotency Test — Quota Reset</h2>
            <p className="text-xs text-gray-500 mb-4">
              Calls the webhook with the <strong>same idempotency key</strong> every time.
              The quota resets only on the first call; subsequent calls are no-ops.
              <br />
              Current key: <code className="text-yellow-400">
                {mounted ? idemKey.slice(-20) : "loading..."}
              </code>
              {callCount > 0 && (
                <span className="ml-2 text-green-400">({callCount} call{callCount > 1 ? 's' : ''} made — first processed, rest idempotent)</span>
              )}
            </p>
            <div className="flex gap-3">
              <button
                onClick={callWebhook}
                disabled={loading !== null}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-sm rounded-lg transition"
              >
                {loading === 'webhook' ? 'Calling…' : 'Call Webhook (same key)'}
              </button>
              <button
                onClick={callFreshWebhook}
                disabled={loading !== null}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm rounded-lg transition"
              >
                {loading === 'fresh' ? 'Calling…' : 'Call With New Key (actually resets)'}
              </button>
            </div>
          </div>

          {/* Card: Concurrent leads */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-sm font-bold mb-1">⚡ Concurrency Test — Generate 10 Leads</h2>
            <p className="text-xs text-gray-500 mb-4">
              Fires 10 lead creation requests simultaneously (Promise.all) to verify
              correct allocation under concurrent load. Check the dashboard live.
            </p>
            <button
              onClick={generateLeads}
              disabled={loading !== null}
              className="px-4 py-2 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white text-sm rounded-lg transition"
            >
              {loading === 'leads' ? 'Generating…' : 'Generate 10 Leads Now'}
            </button>
          </div>

          {/* Log */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold">📋 Activity Log</h2>
              <button onClick={() => setLog([])} className="text-xs text-gray-600 hover:text-gray-400">
                Clear
              </button>
            </div>
            {log.length === 0 ? (
              <p className="text-xs text-gray-700 italic">No actions yet.</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto text-xs">
                {log.map((entry, i) => (
                  <p key={i} className="text-gray-400">{entry}</p>
                ))}
              </div>
            )}
          </div>
        </div>

        <p className="text-xs text-gray-700 mt-6 text-center">
          <a href="/dashboard" className="underline hover:text-gray-500">← Back to Dashboard</a>
        </p>
      </div>
    </main>
  );
}
