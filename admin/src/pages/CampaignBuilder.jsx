import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Bell } from 'lucide-react';
import API from '../api.js';

function NotifPreview({ title, body, icon }) {
    const iconEl = icon
        ? <img src={icon} style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover' }} alt="" />
        : <div className="notif-icon"><Bell size={18} /></div>;
    const t = title || 'Notification Title';
    const b = body || 'Notification body text will appear here.';

    return (
        <div className="notif-preview-wrap">
            {[
                { label: 'Windows 10/11', cls: 'notif-win' },
                { label: 'macOS', cls: 'notif-mac' },
                { label: 'Android', cls: 'notif-android' },
            ].map(({ label, cls }) => (
                <div key={label}>
                    <div className="notif-os-label">{label}</div>
                    <div className={`notif-preview ${cls}`}>
                        {iconEl}
                        <div className="notif-content">
                            <h4>{t}</h4>
                            <p>{b}</p>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

export default function CampaignBuilder() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [sites, setSites] = useState([]);
    const [form, setForm] = useState({ siteId: '', title: '', body: '', iconUrl: '', badgeUrl: '', imageUrl: '', targetUrl: '', scheduledAt: '' });
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        API.get('/api/admin/sites').then(({ data }) => setSites(data.sites || []));
        if (id) API.get(`/api/admin/campaigns/${id}`).then(({ data }) => setForm({ ...data.campaign, siteId: String(data.campaign.siteId), scheduledAt: '' }));
    }, [id]);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    async function handleSave(e) {
        e.preventDefault(); setError(''); setSaving(true);
        try {
            if (id) await API.put(`/api/admin/campaigns/${id}`, form);
            else await API.post('/api/admin/campaigns', form);
            navigate('/campaigns');
        } catch (err) { setError(err.response?.data?.message || 'Failed to save campaign.'); }
        finally { setSaving(false); }
    }

    return (
        <>
            <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16 }}>
                    <h1>{id ? 'Edit Campaign' : 'New Campaign'}</h1>
                </div>
            </div>
            <div className="page-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24, alignItems: 'start' }}>
                    {/* Form */}
                    <div className="card">
                        {error && <div className="alert alert-error">{error}</div>}
                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div className="form-group">
                                <label className="form-label">Target Site *</label>
                                <select className="form-select" required value={form.siteId} onChange={e => set('siteId', e.target.value)}>
                                    <option value="">Select a site…</option>
                                    {sites.map(s => <option key={s.id} value={String(s.id)}>{s.name} ({s.domain})</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Title * <span className="form-hint" style={{ display: 'inline' }}>({form.title.length}/50)</span></label>
                                <input className="form-input" required maxLength={50} value={form.title} onChange={e => set('title', e.target.value)} placeholder="Your notification title" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Body * <span className="form-hint" style={{ display: 'inline' }}>({form.body.length}/120)</span></label>
                                <textarea className="form-textarea" required maxLength={120} value={form.body} onChange={e => set('body', e.target.value)} placeholder="Notification body text…" />
                            </div>
                            <div className="form-row">
                                <div className="form-group"><label className="form-label">Icon URL</label><input className="form-input" value={form.iconUrl} onChange={e => set('iconUrl', e.target.value)} placeholder="https://…/icon.png" /></div>
                                <div className="form-group"><label className="form-label">Badge URL</label><input className="form-input" value={form.badgeUrl} onChange={e => set('badgeUrl', e.target.value)} placeholder="https://…/badge.png" /></div>
                            </div>
                            <div className="form-group"><label className="form-label">Large Image URL</label><input className="form-input" value={form.imageUrl} onChange={e => set('imageUrl', e.target.value)} placeholder="https://…/banner.jpg" /></div>
                            <div className="form-group"><label className="form-label">Target URL (click destination) *</label><input className="form-input" required value={form.targetUrl} onChange={e => set('targetUrl', e.target.value)} placeholder="https://…" /></div>
                            <div className="form-group">
                                <label className="form-label">Schedule (leave empty to save as draft)</label>
                                <input className="form-input" type="datetime-local" value={form.scheduledAt} onChange={e => set('scheduledAt', e.target.value)} />
                            </div>
                            <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                                <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Campaign'}</button>
                                <button className="btn btn-ghost" type="button" onClick={() => navigate('/campaigns')}>Cancel</button>
                            </div>
                        </form>
                    </div>

                    {/* Live Preview */}
                    <div className="card">
                        <div className="card-header"><h3>Live Preview</h3></div>
                        <NotifPreview title={form.title} body={form.body} icon={form.iconUrl} />
                    </div>
                </div>
            </div>
        </>
    );
}
