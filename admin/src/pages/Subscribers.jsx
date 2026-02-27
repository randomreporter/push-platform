import { useEffect, useState, useCallback } from 'react';
import { Download, Trash2, Filter, RefreshCw } from 'lucide-react';
import API from '../api.js';

export default function Subscribers() {
    const [subscribers, setSubscribers] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState({ site_id: '', browser: '', os: '', country: '', status: '' });
    const [loading, setLoading] = useState(true);
    const [lastRefreshed, setLastRefreshed] = useState(null);
    const [sites, setSites] = useState([]);

    const load = useCallback((p = page, f = filters) => {
        const params = new URLSearchParams({
            page: p,
            limit: 50,
            ...Object.fromEntries(Object.entries(f).filter(([, v]) => v))
        });
        setLoading(true);
        API.get(`/api/admin/subscribers?${params}`)
            .then(({ data }) => {
                setSubscribers(data.subscribers || []);
                setTotal(data.total || 0);
                setLastRefreshed(new Date());
            })
            .finally(() => setLoading(false));
    }, []);

    // Initial load
    useEffect(() => {
        load(1, filters);
        API.get('/api/admin/sites').then(({ data }) => setSites(data.sites || [])).catch(console.error);
    }, []);

    // Auto-refresh every 15 seconds
    useEffect(() => {
        const interval = setInterval(() => load(page, filters), 15000);
        return () => clearInterval(interval);
    }, [page, filters, load]);

    const setF = (k, v) => setFilters(f => ({ ...f, [k]: v }));

    const applyFilters = () => { setPage(1); load(1, filters); };
    const clearFilters = () => {
        const empty = { site_id: '', browser: '', os: '', country: '', status: '' };
        setFilters(empty);
        setPage(1);
        load(1, empty);
    };

    async function handleExport() {
        const params = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([, v]) => v)));
        window.open(`/api/admin/subscribers/export?${params}`, '_blank');
    }

    async function handleDelete(id) {
        await API.delete(`/api/admin/subscribers/${id}`);
        load(page, filters);
    }

    const pages = Math.ceil(total / 50);

    return (
        <>
            <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16 }}>
                    <div>
                        <h1>
                            Subscribers{' '}
                            <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 400 }}>
                                ({total.toLocaleString()} total)
                            </span>
                        </h1>
                        {lastRefreshed && (
                            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                Last updated: {lastRefreshed.toLocaleTimeString()} · auto-refreshes every 15s
                            </p>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-ghost" onClick={() => load(page, filters)} title="Refresh now">
                            <RefreshCw size={14} className={loading ? 'spinning' : ''} /> Refresh
                        </button>
                        <button className="btn btn-ghost" onClick={handleExport}>
                            <Download size={14} /> Export CSV
                        </button>
                    </div>
                </div>
            </div>
            <div className="page-body">
                {/* Filters */}
                <div className="card" style={{ marginBottom: 16, padding: 16 }}>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <Filter size={16} style={{ color: 'var(--text-muted)', marginTop: 'auto', marginBottom: 6 }} />
                        <div className="form-group" style={{ minWidth: 160 }}>
                            <label className="form-label">Site</label>
                            <select className="form-select" value={filters.site_id} onChange={e => setF('site_id', e.target.value)}>
                                <option value="">All Sites</option>
                                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        {[['browser', 'Browser'], ['os', 'OS'], ['country', 'Country (2-letter)'], ['status', 'Status']].map(([k, label]) => (
                            <div key={k} className="form-group" style={{ minWidth: 140 }}>
                                <label className="form-label">{label}</label>
                                <input
                                    className="form-input"
                                    value={filters[k]}
                                    onChange={e => setF(k, e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && applyFilters()}
                                    placeholder={`Filter ${label.toLowerCase()}…`}
                                />
                            </div>
                        ))}
                        <button className="btn btn-primary btn-sm" style={{ marginBottom: 1 }} onClick={applyFilters}>Apply</button>
                        <button className="btn btn-ghost btn-sm" style={{ marginBottom: 1 }} onClick={clearFilters}>Clear</button>
                    </div>
                </div>

                <div className="card">
                    {loading && subscribers.length === 0 ? (
                        <div className="spinner" />
                    ) : subscribers.length === 0 ? (
                        <div className="empty-state">
                            <h3>No subscribers found</h3>
                            <p>Try adjusting your filters, or check that the embed code is installed on your site.</p>
                        </div>
                    ) : (
                        <>
                            <div className="table-wrap">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>ID</th><th>Browser</th><th>OS</th><th>Country</th>
                                            <th>Status</th><th>Tags</th><th>Last Seen</th><th>Subscribed</th><th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {subscribers.map(s => (
                                            <tr key={s.id}>
                                                <td style={{ color: 'var(--text-muted)' }}>#{s.id}</td>
                                                <td>{s.browser || '—'}</td>
                                                <td>{s.os || '—'}</td>
                                                <td>{s.country || '—'}</td>
                                                <td><span className={`badge badge-${s.status}`}>{s.status}</span></td>
                                                <td style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {!s.tags || s.tags === '{}' ? '—' : s.tags}
                                                </td>
                                                <td>{s.lastSeenAt ? new Date(s.lastSeenAt).toLocaleDateString() : '—'}</td>
                                                <td>{new Date(s.createdAt).toLocaleDateString()}</td>
                                                <td>
                                                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.id)}>
                                                        <Trash2 size={12} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {pages > 1 && (
                                <div className="pagination">
                                    <span className="pagination-info">
                                        Showing {(page - 1) * 50 + 1}–{Math.min(page * 50, total)} of {total}
                                    </span>
                                    {Array.from({ length: Math.min(pages, 7) }, (_, i) => i + 1).map(p => (
                                        <button key={p} className={p === page ? 'active' : ''} onClick={() => { setPage(p); load(p, filters); }}>
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinning { animation: spin 1s linear infinite; }
      `}</style>
        </>
    );
}
