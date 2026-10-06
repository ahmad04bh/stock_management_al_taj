import { NavLink } from 'react-router-dom';

const navItems = [
  { group: 'Overview', items: [
    { to: '/', label: 'Dashboard', icon: '📊' },
  ]},
  { group: 'Catalogue', items: [
    { to: '/categories', label: 'Categories', icon: '🏷️' },
    { to: '/brands',     label: 'Brands',     icon: '⭐' },
    { to: '/products',   label: 'Products',   icon: '📦' },
  ]},
  { group: 'Contacts', items: [
    { to: '/clients',      label: 'Clients',      icon: '👥' },
    { to: '/fournisseurs', label: 'Fournisseurs',  icon: '🏭' },
  ]},
  { group: 'Facturation', items: [
    { to: '/factures-vente', label: 'Ventes',   icon: '🧾' },
    { to: '/factures-achat', label: 'Achats',   icon: '🛒' },
  ]},
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h1>Al Taj</h1>
        <span>Stock Management</span>
      </div>
      <nav className="sidebar-nav">
        {navItems.map(group => (
          <div key={group.group}>
            <div className="nav-group-label">{group.group}</div>
            {group.items.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
