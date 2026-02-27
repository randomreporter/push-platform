import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Globe, Megaphone, Users, BarChart2, Webhook, LogOut, Bell } from 'lucide-react';
import API from '../api.js';

const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, to: '/' },
    { label: 'Sites', icon: Globe, to: '/sites' },
    { label: 'Campaigns', icon: Megaphone, to: '/campaigns' },
    { label: 'Subscribers', icon: Users, to: '/subscribers' },
    { label: 'Analytics', icon: BarChart2, to: '/analytics' },
    { label: 'Webhooks', icon: Webhook, to: '/webhooks' },
];

export default function Layout() {
    const navigate = useNavigate();

    async function handleLogout() {
        await API.post('/api/auth/logout').catch(() => { });
        localStorage.removeItem('pp_token');
        navigate('/login');
    }

    return (
        <div className="app-layout">
            <aside className="sidebar">
                <div className="sidebar-logo">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <div style={{ width: 32, height: 32, background: 'var(--accent-light)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Bell size={16} color="var(--accent)" />
                        </div>
                        <div>
                            <h2>PushPlatform</h2>
                            <span>self-hosted</span>
                        </div>
                    </div>
                </div>
                <nav className="sidebar-nav">
                    {navItems.map(({ label, icon: Icon, to }) => (
                        <NavLink key={to} to={to} end={to === '/'} style={{ textDecoration: 'none' }}>
                            {({ isActive }) => (
                                <div className={`nav-item ${isActive ? 'active' : ''}`}>
                                    <Icon size={17} />
                                    {label}
                                </div>
                            )}
                        </NavLink>
                    ))}
                </nav>
                <div className="sidebar-footer">
                    <button className="nav-item" onClick={handleLogout} style={{ width: '100%' }}>
                        <LogOut size={16} />
                        Sign out
                    </button>
                </div>
            </aside>
            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
}
