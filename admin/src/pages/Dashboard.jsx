import { useEffect, useState } from 'react';
import { Users, Megaphone, MousePointerClick, TrendingUp } from 'lucide-react';
import API from '../api.js';

export default function Dashboard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        API.get('/api/admin').then(({ data }) => setData(data)).catch(console.error).finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="spinner" />;

    const { metrics = {}, recentCampaigns = [] } = data || {};

    const cards = [
        { label: 'Total Subscribers', value: metrics.totalSubscribers?.toLocaleString() || '0', sub: `+${metrics.newToday || 0} today`, icon: Users, cls: 'icon-purple' },
        { label: 'Total Campaigns', value: metrics.totalCampaigns?.toLocaleString() || '0', icon: Megaphone, cls: 'icon-amber' },
        { label: 'Active Dispatching', value: metrics.activeCampaigns || '0', icon: TrendingUp, cls: 'icon-green' },
        { label: 'Subscribers Today', value: metrics.newToday || '0', icon: MousePointerClick, cls: 'icon-blue' },
    ];

    return (
        <>
            <div className="page-header">
                <h1>Dashboard</h1>
            </div>
            <div className="page-body">
                <div className="grid-4" style={{ marginBottom: 28 }}>
                    {cards.map(({ label, value, sub, icon: Icon, cls }) => (
                        <div className="metric-card" key={label}>
                            <div className={`metric-icon ${cls}`}><Icon size={18} /></div>
                            <div className="metric-label">{label}</div>
                            <div className="metric-value">{value}</div>
                            {sub && <div className="metric-sub">{sub}</div>}
                        </div>
                    ))}
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3>Recent Campaigns</h3>
                        <a href="/campaigns" style={{ fontSize: 13 }}>View all →</a>
                    </div>
                    {recentCampaigns.length === 0 ? (
                        <div className="empty-state">
                            <Megaphone size={40} />
                            <h3>No campaigns yet</h3>
                            <p>Create your first campaign to start sending push notifications.</p>
                        </div>
                    ) : (
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Campaign</th>
                                        <th>Status</th>
                                        <th>Targeted</th>
                                        <th>Delivered</th>
                                        <th>Clicked</th>
                                        <th>CTR</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentCampaigns.map(c => (
                                        <tr key={c.id}>
                                            <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{c.title}</td>
                                            <td><span className={`badge badge-${c.status}`}>{c.status}</span></td>
                                            <td>{c.targetedCount?.toLocaleString()}</td>
                                            <td>{c.deliveredCount?.toLocaleString()}</td>
                                            <td>{c.clickedCount?.toLocaleString()}</td>
                                            <td style={{ color: 'var(--success)' }}>{c.ctr}</td>
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
