'use client';

import { useState } from 'react';

const SERVICES = [
  { id: 1, name: 'Service 1' },
  { id: 2, name: 'Service 2' },
  { id: 3, name: 'Service 3' },
];

export default function RequestServicePage() {
  const [form, setForm] = useState({
    name: '', phone: '', city: '', serviceId: '', description: '',
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<{ assignedProviderIds?: number[] } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setMessage('');
    setResult(null);

    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, serviceId: Number(form.serviceId) }),
    });

    const raw = await res.text();
    const data = raw ? JSON.parse(raw) : null;

    if (res.ok) {
      setStatus('success');
      setMessage('Your enquiry has been submitted successfully!');
      setResult(data);
      setForm({ name: '', phone: '', city: '', serviceId: '', description: '' });
    } else {
      setStatus('error');
      setMessage(data?.error ?? 'Something went wrong. Please try again.');
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full mb-3">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
            PROWIDER
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Request a Service</h1>
          <p className="text-sm text-gray-500 mt-1">Fill in your details and we'll match you with the right providers.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              name="name" value={form.name} onChange={handleChange} required
              placeholder="e.g. Rahul Sharma"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input
              name="phone" value={form.phone} onChange={handleChange} required
              placeholder="e.g. 9999999999"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input
              name="city" value={form.city} onChange={handleChange} required
              placeholder="e.g. Mumbai"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Service Type</label>
            <select
              name="serviceId" value={form.serviceId} onChange={handleChange} required
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Select a service</option>
              {SERVICES.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              name="description" value={form.description} onChange={handleChange} required
              rows={3}
              placeholder="Briefly describe your requirement..."
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-lg text-sm transition-colors"
          >
            {status === 'loading' ? 'Submitting…' : 'Submit Enquiry'}
          </button>
        </form>

        {/* Feedback */}
        {message && (
          <div className={`mt-4 p-4 rounded-lg text-sm ${status === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            <p className="font-semibold">{status === 'success' ? '✅ Success' : '❌ Error'}</p>
            <p>{message}</p>
            {result?.assignedProviderIds && (
              <p className="mt-1 text-xs">
                Assigned to Providers: {result.assignedProviderIds.join(', ')}
              </p>
            )}
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">
          <a href="/dashboard" className="underline hover:text-gray-600">View Provider Dashboard →</a>
        </p>
      </div>
    </main>
  );
}
