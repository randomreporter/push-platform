import { useEffect, useState } from 'react';
import { Plus, Send, Trash2, Edit2, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import API from '../api.js';

export default function Campaigns() {
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState({}); // { [id]: true } while sending
    const [confirmSendId, setConfirmSendId] = useState(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const navigate = useNavigate();

    const load = () =>
        API.get('/api/admin/campaigns')
            .then(({ data }) => setCampaigns(data.campaigns || []))
            .finally(() => setLoading(false));

    useEffect(() => { load(); }, []);

    // Auto-refresh every 8 seconds so dispatching → completed updates automatically
    useEffect(() => {
        const t = setInterval(load, 8000);
        return () => clearInterval(t);
    }, []);

    async function handleSend(id) {
        setConfirmSendId(null);
        // Instant visual feedback — disable button and show spinner
        setSending(s => ({ ...s, [id]: true }));
        setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: 'dispatching' } : c));

        try {
            await API.post(`/api/admin/campaigns/${id}/send`);
        } catch (e) {
            const msg = e.response?.data?.message || e.message || 'Send failed. Please try again.';
            alert(msg);
            // Revert optimistic update on error
            setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: 'draft' } : c));
        } finally {
            setSending(s => { const n = { ...s }; delete n[id]; return n; });
        }

        // Refresh list after short delay to pick up completed status
        setTimeout(load, 4000);
    }

    async function handleDelete(id) {
        setConfirmDeleteId(null);
        await API.delete(`/api/admin/campaigns/${id}`).catch(console.error);
        load();
    }

    return (
        <>
            <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16 }}>
                    <h1>Campaigns</h1>
                    <button className="btn btn-primary" onClick={() => navigate('/campaigns/new')}>
                        <Plus size={15} /> New Campaign
                    </button>
                </div>
            </div>
            <div className="page-body">
                {loading ? <div className="spinner" /> : campaigns.length === 0 ? (
                    <div className="empty-state">
                        <h3>No campaigns yet</h3>
                        <p>Create your first push notification campaign.</p>
                    </div>
                ) : (
                    <div className="card">
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Title</th>
                                        <th>Status</th>
                                        <th>Targeted</th>
                                        <th>Delivered</th>
                                        <th>Failed</th>
                                        <th>CTR</th>
                                        <th>Created</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {campaigns.map(c => {
                                        const ctr = c.deliveredCount > 0
                                            ? ((c.clickedCount / c.deliveredCount) * 100).toFixed(1) + '%'
                                            : '—';
                                        const isSending = sending[c.id];
                                        return (
                                            <tr key={c.id}>
                                                <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{c.title}</td>
                                                <td><span className={`badge badge-${c.status}`}>{c.status}</span></td>
                                                <td>{c.targetedCount > 0 ? c.targetedCount.toLocaleString() : '—'}</td>
                                                <td>{c.deliveredCount > 0 ? c.deliveredCount.toLocaleString() : '—'}</td>
                                                <td>{c.failedCount > 0 ? <span style={{ color: 'var(--danger)' }}>{c.failedCount}</span> : '—'}</td>
                                                <td style={{ color: 'var(--success)' }}>{ctr}</td>
                                                <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                                                <td>
                                                    {['draft', 'scheduled'].includes(c.status) && (
                                                        <div style={{ display: 'flex', gap: 6 }}>
                                                            <button
                                                                className="btn btn-primary btn-sm"
                                                                onClick={() => setConfirmSendId(c.id)}
                                                                disabled={isSending}
                                                                title="Send now to all active subscribers"
                                                            >
                                                                {isSending
                                                                    ? <><Loader2 size={12} className="spinning" /> Sending…</>
                                                                    : <><Send size={12} /> Send</>}
                                                            </button>
                                                            <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/campaigns/${c.id}/edit`)}><Edit2 size={12} /></button>
                                                            <button className="btn btn-danger btn-sm" onClick={() => setConfirmDeleteId(c.id)}><Trash2 size={12} /></button>
                                                        </div>
                                                    )}
                                                    {c.status === 'dispatching' && (
                                                        <span style={{ color: 'var(--accent)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
                                                            <Loader2 size={12} className="spinning" /> Sending…
                                                        </span>
                                                    )}
                                                    {c.status === 'completed' && (
                                                        <span style={{ color: 'var(--success)', fontSize: 12 }}>✓ Done</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Custom Confirm Send Modal */}
            {confirmSendId && (
                <div className="modal-backdrop">
                    <div className="modal card">
                        <h3>Send Campaign?</h3>
                        <p>Are you sure you want to send this campaign to all active subscribers right now?</p>
                        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
                            <button className="btn btn-ghost" onClick={() => setConfirmSendId(null)}>Cancel</button>
                            <button className="btn btn-primary" onClick={() => handleSend(confirmSendId)}>Confirm Send</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Confirm Delete Modal */}
            {confirmDeleteId && (
                <div className="modal-backdrop">
                    <div className="modal card">
                        <h3>Delete Campaign?</h3>
                        <p>Are you sure you want to delete this campaign permanently?</p>
                        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
                            <button className="btn btn-ghost" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                            <button className="btn btn-danger" onClick={() => handleDelete(confirmDeleteId)}>Delete</button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinning { animation: spin 1s linear infinite; }
        .modal-backdrop {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.5); z-index: 1000;
            display: flex; align-items: center; justify-content: center;
        }
        .modal { width: 400px; max-width: 90%; }
      `}</style>
        </>
    );
}
