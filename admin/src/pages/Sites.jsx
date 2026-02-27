import { useEffect, useState } from 'react';
import { Plus, Globe, Copy, Trash2, ChevronRight } from 'lucide-react';
import API from '../api.js';

export default function Sites() {
    const [sites, setSites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [selectedSite, setSelectedSite] = useState(null);
    const [embedCode, setEmbedCode] = useState('');
    const [form, setForm] = useState({ name: '', domain: '', defaultIconUrl: '', promptMode: 'custom', promptDelayMs: 3000 });
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const load = () => API.get('/api/admin/sites').then(({ data }) => setSites(data.sites || [])).catch(console.error).finally(() => setLoading(false));
    useEffect(() => { load(); }, []);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    async function handleCreate(e) {
        e.preventDefault(); setError(''); setSaving(true);
        try {
            const { data } = await API.post('/api/admin/sites', form);
            setEmbedCode(data.embedCode);
            setSelectedSite(data.site);
            setShowForm(false);
            load();
        } catch (err) { setError(err.response?.data?.message || 'Failed to create site.'); }
        finally { setSaving(false); }
    }

    async function handleDelete(id) {
        if (!confirm('Delete this site and all its subscribers/campaigns?')) return;
        await API.delete(`/api/admin/sites/${id}`).catch(console.error);
        load();
    }

    async function viewEmbedCode(id) {
        const { data } = await API.get(`/api/admin/sites/${id}`);
        setEmbedCode(data.embedCode);
        setSelectedSite(data.site);
    }

    return (
        <>
            <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16 }}>
                    <h1>Sites</h1>
                    <button className="btn btn-primary" onClick={() => setShowForm(v => !v)}><Plus size={15} /> Add Site</button>
                </div>
            </div>
            <div className="page-body">
                {showForm && (
                    <div className="card" style={{ marginBottom: 20 }}>
                        <div className="card-header"><h3>New Site</h3></div>
                        {error && <div className="alert alert-error">{error}</div>}
                        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div className="form-row">
                                <div className="form-group"><label className="form-label">Site Name</label><input className="form-input" required value={form.name} onChange={e => set('name', e.target.value)} placeholder="My Website" /></div>
                                <div className="form-group"><label className="form-label">Domain</label><input className="form-input" required value={form.domain} onChange={e => set('domain', e.target.value)} placeholder="example.com" /></div>
                            </div>
                            <div className="form-row">
                                <div className="form-group"><label className="form-label">Default Icon URL</label><input className="form-input" value={form.defaultIconUrl} onChange={e => set('defaultIconUrl', e.target.value)} placeholder="https://..." /></div>
                                <div className="form-group"><label className="form-label">Prompt Mode</label>
                                    <select className="form-select" value={form.promptMode} onChange={e => set('promptMode', e.target.value)}>
                                        <option value="native">Native Browser Prompt</option>
                                        <option value="custom">Custom Widget Prompt</option>
                                    </select>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 10 }}>
                                <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create Site'}</button>
                                <button className="btn btn-ghost" type="button" onClick={() => setShowForm(false)}>Cancel</button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Embed Code Modal */}
                {embedCode && (
                    <div className="card" style={{ marginBottom: 20, borderColor: 'var(--accent)' }}>
                        <div className="card-header">
                            <h3>📋 Embed Code — {selectedSite?.name}</h3>
                            <button className="btn btn-ghost btn-sm" onClick={() => { navigator.clipboard.writeText(embedCode); }}><Copy size={13} /> Copy</button>
                        </div>
                        <div className="code-block">{embedCode}</div>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>Paste this snippet before the closing &lt;/head&gt; tag on your website.</p>
                        <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => setEmbedCode('')}>Dismiss</button>
                    </div>
                )}

                {loading ? <div className="spinner" /> : sites.length === 0 ? (
                    <div className="empty-state"><Globe size={40} /><h3>No sites yet</h3><p>Add your first website to get started.</p></div>
                ) : (
                    <div className="card">
                        <div className="table-wrap">
                            <table>
                                <thead><tr><th>Site</th><th>Domain</th><th>Subscribers</th><th>Created</th><th>Actions</th></tr></thead>
                                <tbody>
                                    {sites.map(s => (
                                        <tr key={s.id}>
                                            <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{s.name}</td>
                                            <td><code style={{ fontSize: 12 }}>{s.domain}</code></td>
                                            <td>{s._count?.subscribers || 0}</td>
                                            <td>{new Date(s.createdAt).toLocaleDateString()}</td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    <button className="btn btn-ghost btn-sm" onClick={() => viewEmbedCode(s.id)}><ChevronRight size={13} /> Embed</button>
                                                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.id)}><Trash2 size={13} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
