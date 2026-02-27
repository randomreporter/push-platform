import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import API from '../api.js';

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function Analytics() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        API.get('/api/admin/analytics/overview').then(({ data }) => setData(data)).catch(console.error).finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="spinner" />;

    const { subscribers = {}, byBrowser = [], byOs = [], byCountry = [] } = data || {};

    const growthData = [
        { name: 'This Month', value: subscribers.thisMonth || 0 },
        { name: 'This Week', value: subscribers.thisWeek || 0 },
        { name: 'Total', value: subscribers.total || 0 },
    ];

    return (
        <>
            <div className="page-header"><h1>Analytics</h1></div>
            <div className="page-body">
                {/* Summary Cards */}
                <div className="grid-3" style={{ marginBottom: 24 }}>
                    {[
                        { label: 'Total Active Subscribers', value: subscribers.total?.toLocaleString() || 0 },
                        { label: 'New This Week', value: subscribers.thisWeek?.toLocaleString() || 0 },
                        { label: 'New This Month', value: subscribers.thisMonth?.toLocaleString() || 0 },
                    ].map(({ label, value }) => (
                        <div className="metric-card" key={label}>
                            <div className="metric-label">{label}</div>
                            <div className="metric-value">{value}</div>
                        </div>
                    ))}
                </div>

                <div className="grid-2" style={{ marginBottom: 24 }}>
                    {/* By Browser */}
                    <div className="card">
                        <div className="card-header"><h3>By Browser</h3></div>
                        {byBrowser.length === 0 ? <div className="empty-state" style={{ padding: 20 }}><p>No data yet</p></div> : (
                            <ResponsiveContainer width="100%" height={220}>
                                <PieChart>
                                    <Pie data={byBrowser} dataKey="count" nameKey="browser" outerRadius={80} label={({ browser, percent }) => `${browser} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                                        {byBrowser.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip formatter={(v) => v.toLocaleString()} contentStyle={{ background: '#131929', border: '1px solid #1e2d45', borderRadius: 8 }} />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    {/* By OS */}
                    <div className="card">
                        <div className="card-header"><h3>By Operating System</h3></div>
                        {byOs.length === 0 ? <div className="empty-state" style={{ padding: 20 }}><p>No data yet</p></div> : (
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={byOs} layout="vertical" margin={{ left: 20 }}>
                                    <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                    <YAxis type="category" dataKey="os" tick={{ fill: '#94a3b8', fontSize: 11 }} width={80} />
                                    <Tooltip contentStyle={{ background: '#131929', border: '1px solid #1e2d45', borderRadius: 8 }} />
                                    <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* By Country */}
                <div className="card">
                    <div className="card-header"><h3>Geographic Breakdown</h3></div>
                    {byCountry.length === 0 ? (
                        <div className="empty-state" style={{ padding: 30 }}><p>No country data yet. Make sure GEOIP_DRIVER is enabled in your .env.</p></div>
                    ) : (
                        <div className="table-wrap">
                            <table>
                                <thead><tr><th>#</th><th>Country</th><th>Subscribers</th><th>Share</th></tr></thead>
                                <tbody>
                                    {byCountry.map((r, i) => (
                                        <tr key={r.country}>
                                            <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                                            <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{r.country}</td>
                                            <td>{r.count.toLocaleString()}</td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, maxWidth: 120 }}>
                                                        <div style={{ width: `${((r.count / subscribers.total) * 100).toFixed(0)}%`, height: '100%', background: 'var(--accent)', borderRadius: 3 }} />
                                                    </div>
                                                    <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 36 }}>{((r.count / subscribers.total) * 100).toFixed(1)}%</span>
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
