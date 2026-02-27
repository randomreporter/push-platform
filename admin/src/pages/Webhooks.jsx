import { useEffect, useState } from 'react';
import { Plus, Trash2, Eye, CheckCircle, XCircle } from 'lucide-react';
import API from '../api.js';

const ALL_EVENTS = ['subscriber.created', 'subscriber.deleted', 'notification.delivered', 'notification.clicked', 'notification.dismissed', 'campaign.completed'];

export default function Webhooks() {
    const [sites, setSites] = useState([]);
    const [webhooks, setWebhooks] = useState([]);
    const [deliveries, setDeliveries] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [viewDeliveriesFor, setViewDeliveriesFor] = useState(null);
    const [form, setForm] = useState({ siteId: '', targetUrl: '', events: [] });
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        API.get('/api/admin/sites').then(({ data }) => setSites(data.sites || []));
        load();
    }, []);

    const load = () => API.get('/api/admin/webhooks').then(({ data }) => setWebhooks(data.webhooks || []));
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const toggleEvent = (ev) => setForm(f => ({ ...f, events: f.events.includes(ev) ? f.events.filter(e => e !== ev) : [...f.events, ev] }));

    async function handleCreate(e) {
        e.preventDefault(); setError(''); setSaving(true);
        try {
            await API.post('/api/admin/webhooks', form);
            setShowForm(false);
            setForm({ siteId: '', targetUrl: '', events: [] });
            load();
        } catch (err) { setError(err.response?.data?.message || 'Failed to create webhook.'); }
        finally { setSaving(false); }
    }

    async function handleDelete(id) {
        if (!confirm('Delete this webhook?')) return;
        await API.delete(`/api/admin/webhooks/${id}`);
        load();
    }

    async function handleToggle(wh) {
        await API.put(`/api/admin/webhooks/${wh.id}`, { isActive: !wh.isActive });
        load();
    }

    async function viewDeliveries(id) {
        const { data } = await API.get(`/api/admin/webhooks/${id}/deliveries`);
        setDeliveries(data.deliveries || []);
        setViewDeliveriesFor(id);
    }

    const parsedEvents = (evJson) => { try { return JSON.parse(evJson); } catch { return []; } };

    return (
        <>
            <div className="page-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16 }}>
                    <h1>Webhooks</h1>
                    <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}><Plus size={15} /> Add Webhook</button>
                </div>
            </div>
            <div className="page-body">
                {showForm && (
                    <div className="card" style={{ marginBottom: 20 }}>
                        <div className="card-header"><h3>New Webhook</h3></div>
                        {error && <div className="alert alert-error">{error}</div>}
                        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Site</label>
                                    <select className="form-select" required value={form.siteId} onChange={e => set('siteId', Number(e.target.value))}>
                                        <option value="">Select site…</option>
                                        {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Target URL (HTTPS)</label>
                                    <input className="form-input" required value={form.targetUrl} onChange={e => set('targetUrl', e.target.value)} placeholder="https://your-server.com/hook" />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Events to subscribe</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                                    {ALL_EVENTS.map(ev => (
                                        <button type="button" key={ev} onClick={() => toggleEvent(ev)}
                                            className={`badge ${form.events.includes(ev) ? 'badge-active' : 'badge-draft'}`}
                                            style={{ cursor: 'pointer', padding: '5px 10px', fontSize: 12 }}>
                                            {ev}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 10 }}>
                                <button className="btn btn-primary" type="submit" disabled={saving || !form.events.length}>{saving ? 'Saving…' : 'Create Webhook'}</button>
                                <button className="btn btn-ghost" type="button" onClick={() => setShowForm(false)}>Cancel</button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Delivery log panel */}
                {viewDeliveriesFor && (
                    <div className="card" style={{ marginBottom: 20 }}>
                        <div className="card-header">
                            <h3>Delivery Log</h3>
                            <button className="btn btn-ghost btn-sm" onClick={() => setViewDeliveriesFor(null)}>✕ Close</button>
                        </div>
                        {deliveries.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No deliveries yet.</p> : (
                            <div className="table-wrap">
                                <table>
                                    <thead><tr><th>Event</th><th>Status</th><th>HTTP</th><th>Attempt</th><th>Time</th></tr></thead>
                                    <tbody>
                                        {deliveries.map(d => (
                                            <tr key={d.id}>
                                                <td><code style={{ fontSize: 11 }}>{d.eventName}</code></td>
                                                <td>
                                                    {d.status === 'success'
                                                        ? <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle size={13} /> success</span>
                                                        : <span style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 4 }}><XCircle size={13} /> {d.status}</span>}
                                                </td>
                                                <td>{d.httpStatus || '—'}</td>
                                                <td>{d.attempt}</td>
                                                <td>{new Date(d.createdAt).toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                <div className="card">
                    {webhooks.length === 0 ? (
                        <div className="empty-state"><h3>No webhooks configured</h3><p>Add a webhook to receive real-time event notifications.</p></div>
                    ) : (
                        <div className="table-wrap">
                            <table>
                                <thead><tr><th>Target URL</th><th>Events</th><th>Active</th><th>Actions</th></tr></thead>
                                <tbody>
                                    {webhooks.map(wh => (
                                        <tr key={wh.id}>
                                            <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>{wh.targetUrl}</td>
                                            <td>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                    {parsedEvents(wh.events).map(ev => <span key={ev} className="badge badge-dispatching" style={{ fontSize: 10 }}>{ev.split('.')[1]}</span>)}
                                                </div>
                                            </td>
                                            <td>
                                                <button className={`badge ${wh.isActive ? 'badge-active' : 'badge-failed'}`} style={{ cursor: 'pointer', border: 'none' }} onClick={() => handleToggle(wh)}>
                                                    {wh.isActive ? 'active' : 'paused'}
                                                </button>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    <button className="btn btn-ghost btn-sm" onClick={() => viewDeliveries(wh.id)}><Eye size={13} /> Logs</button>
                                                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(wh.id)}><Trash2 size={13} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
