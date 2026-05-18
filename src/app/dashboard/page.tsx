'use client';

import { useEffect, useState, useCallback } from 'react';

interface Lead {
  id: number;
  name: string;
  phone: string;
  city: string;
  description: string;
  createdAt: string;
  service: { name: string };
}

interface Assignment {
  id: number;
  assignedAt: string;
  lead: Lead;
}

interface Provider {
  id: number;
  name: string;
  monthlyQuota: number;
  leadsReceived: number;
  assignments: Assignment[];
}

export default function DashboardPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [sseStatus, setSseStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [selected, setSelected] = useState<number | null>(null);

  const fetchProviders = useCallback(async () => {
    const res = await fetch('/api/providers');
    const data = await res.json();
    setProviders(data.providers ?? []);
    setLastUpdate(new Date());
    setLoading(false);
  }, []);

  // Initial fetch
  useEffect(() => { fetchProviders(); }, [fetchProviders]);

  // SSE subscription
  useEffect(() => {
    const es = new EventSource('/api/events');

    es.onopen = () => setSseStatus('connected');
    es.onerror = () => setSseStatus('disconnected');

    es.addEventListener('lead_assigned', async (event) => {
      console.log('Lead assigned event received');

      const data = JSON.parse(event.data);

      console.log(data);

      await fetchProviders();
    });

    es.addEventListener('quota_reset', async () => {
      console.log('Quota reset event received');

      await fetchProviders();
    });

    return () => es.close();
  }, [fetchProviders]);

  const activeProvider = providers.find((p) => p.id === selected);

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-6 font-mono">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold tracking-tight">PROWIDER — Provider Dashboard</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {lastUpdate ? `Last updated: ${lastUpdate.toLocaleTimeString()}` : 'Loading…'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border ${sseStatus === 'connected'
            ? 'border-green-700 text-green-400'
            : sseStatus === 'connecting'
              ? 'border-yellow-700 text-yellow-400'
              : 'border-red-700 text-red-400'
            }`}>
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${sseStatus === 'connected' ? 'bg-green-400' : sseStatus === 'connecting' ? 'bg-yellow-400' : 'bg-red-400'
              }`} />
            {sseStatus === 'connected' ? 'Live' : sseStatus === 'connecting' ? 'Connecting…' : 'Disconnected'}
          </span>

          <a href="/request-service" className="text-xs text-blue-400 underline hover:text-blue-300">
            + New Lead
          </a>
          <a href="/test-tools" className="text-xs text-gray-500 underline hover:text-gray-300">
            Test Tools
          </a>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-16">Loading providers…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Provider cards grid */}
          <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {providers.map((p) => {
              const used = p.leadsReceived;
              const total = p.monthlyQuota;
              const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
              const isSelected = selected === p.id;

              return (
                <button
                  key={p.id}
                  onClick={() => setSelected(isSelected ? null : p.id)}
                  className={`relative p-4 rounded-xl border text-left transition-all ${isSelected
                    ? 'border-blue-500 bg-blue-950'
                    : 'border-gray-800 bg-gray-900 hover:border-gray-600'
                    }`}
                >
                  <p className="text-xs text-gray-500 mb-1">P{p.id}</p>
                  <p className="text-sm font-semibold truncate">{p.name}</p>

                  {/* Quota bar */}
                  <div className="mt-3 mb-1 w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400">
                    <span className="text-white font-bold">{used}</span>/{total} leads
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {total - used} remaining
                  </p>

                  {/* Assignment count badge */}
                  <div className="absolute top-3 right-3 text-xs bg-gray-800 rounded px-1.5 py-0.5 text-gray-400">
                    {p.assignments.length}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Lead detail panel */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 h-fit lg:sticky lg:top-6">
            {activeProvider ? (
              <>
                <h2 className="font-bold text-sm mb-1">{activeProvider.name}</h2>
                <p className="text-xs text-gray-500 mb-4">
                  {activeProvider.leadsReceived} leads received · {activeProvider.monthlyQuota - activeProvider.leadsReceived} slots remaining
                </p>

                {activeProvider.assignments.length === 0 ? (
                  <p className="text-xs text-gray-600 italic">No leads assigned yet.</p>
                ) : (
                  <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                    {activeProvider.assignments.map((a) => (
                      <div key={a.id} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-blue-400">{a.lead.service.name}</span>
                          <span className="text-xs text-gray-600">#{a.lead.id}</span>
                        </div>
                        <p className="text-sm font-medium">{a.lead.name}</p>
                        <p className="text-xs text-gray-500">{a.lead.phone} · {a.lead.city}</p>
                        <p className="text-xs text-gray-600 mt-1 truncate">{a.lead.description}</p>
                        <p className="text-xs text-gray-700 mt-1">
                          {new Date(a.assignedAt).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center text-gray-600 py-8">
                <p className="text-sm">Select a provider</p>
                <p className="text-xs mt-1">to view their assigned leads</p>
              </div>
            )}
          </div>

          {/* Summary row */}
          <div className="lg:col-span-3 grid grid-cols-3 gap-3">
            {[
              { label: 'Total Leads', value: providers.reduce((s, p) => s + p.assignments.length, 0) },
              { label: 'Providers Active', value: providers.filter((p) => p.leadsReceived > 0).length },
              { label: 'At Quota', value: providers.filter((p) => p.leadsReceived >= p.monthlyQuota).length },
            ].map((stat) => (
              <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold mt-1">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
