import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle } from 'lucide-react';
import API from '../api.js';

const STEPS = ['Welcome', 'Admin Account', 'Confirm'];

export default function Setup() {
    const [step, setStep] = useState(0);
    const [form, setForm] = useState({ adminName: '', adminEmail: '', adminPassword: '', appUrl: 'http://localhost:3001' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        API.get('/api/setup/status').then(({ data }) => {
            if (data.installed) navigate('/login');
        }).catch(() => { });
    }, []);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    async function handleComplete() {
        setError(''); setLoading(true);
        try {
            await API.post('/api/setup/complete', form);
            setDone(true);
        } catch (err) {
            setError(err.response?.data?.message || 'Setup failed.');
        } finally { setLoading(false); }
    }

    if (done) return (
        <div className="setup-page">
            <div className="setup-card" style={{ textAlign: 'center' }}>
                <CheckCircle size={48} color="var(--success)" style={{ margin: '0 auto 16px' }} />
                <h1>Setup complete!</h1>
                <p className="subtitle">Your push platform is ready to use.</p>
                <a href="/login" className="btn btn-primary" style={{ display: 'inline-flex', marginTop: 16 }}>Go to Login →</a>
            </div>
        </div>
    );

    return (
        <div className="setup-page">
            <div className="setup-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                    <div style={{ width: 40, height: 40, background: 'var(--accent-light)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Bell size={20} color="var(--accent)" />
                    </div>
                    <div>
                        <h1 style={{ fontSize: 20 }}>PushPlatform Setup</h1>
                        <p className="subtitle" style={{ margin: 0 }}>Step {step + 1} of {STEPS.length} — {STEPS[step]}</p>
                    </div>
                </div>

                {/* Progress */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
                    {STEPS.map((_, i) => <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= step ? 'var(--accent)' : 'var(--border)' }} />)}
                </div>

                {error && <div className="alert alert-error">{error}</div>}

                {step === 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Welcome to PushPlatform. This wizard will configure your self-hosted push notification server.</p>
                        <div className="form-group">
                            <label className="form-label">Platform URL</label>
                            <input className="form-input" value={form.appUrl} onChange={e => set('appUrl', e.target.value)} placeholder="https://push.yourdomain.com" />
                            <span className="form-hint">The public URL where this server is accessible.</span>
                        </div>
                        <button className="btn btn-primary" onClick={() => setStep(1)}>Continue →</button>
                    </div>
                )}

                {step === 1 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div className="form-group">
                            <label className="form-label">Your Name</label>
                            <input className="form-input" value={form.adminName} onChange={e => set('adminName', e.target.value)} placeholder="Admin Name" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <input className="form-input" type="email" value={form.adminEmail} onChange={e => set('adminEmail', e.target.value)} placeholder="admin@example.com" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Password</label>
                            <input className="form-input" type="password" value={form.adminPassword} onChange={e => set('adminPassword', e.target.value)} placeholder="Min 8 characters" />
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button className="btn btn-ghost" onClick={() => setStep(0)}>← Back</button>
                            <button className="btn btn-primary" onClick={() => {
                                if (!form.adminName || !form.adminEmail || !form.adminPassword) { setError('All fields required.'); return; }
                                setError(''); setStep(2);
                            }}>Continue →</button>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div className="card" style={{ padding: 16 }}>
                            {[['Name', form.adminName], ['Email', form.adminEmail], ['Platform URL', form.appUrl]].map(([k, v]) => (
                                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                                    <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                                    <span style={{ color: 'var(--text-primary)' }}>{v}</span>
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
                            <button className="btn btn-primary" onClick={handleComplete} disabled={loading} style={{ flex: 1, justifyContent: 'center' }}>
                                {loading ? 'Installing…' : '🚀 Complete Setup'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
