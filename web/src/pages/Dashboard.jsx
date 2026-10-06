import { useEffect, useState } from 'react';
import api from '../api';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/categories'),
      api.get('/brands'),
      api.get('/products'),
      api.get('/clients'),
      api.get('/fournisseurs'),
      api.get('/factures-vente'),
      api.get('/factures-achat'),
    ]).then(([cats, brands, prods, clients, fours, fv, fa]) => {
      const totalRevenue = fv.data.data.reduce((sum, f) => sum + parseFloat(f.total_ttc || 0), 0);
      const totalPurchases = fa.data.data.reduce((sum, f) => sum + parseFloat(f.total_ttc || 0), 0);
      setStats({
        categories: cats.data.data.length,
        brands: brands.data.data.length,
        products: prods.data.data.length,
        clients: clients.data.data.length,
        fournisseurs: fours.data.data.length,
        facturesVente: fv.data.data.length,
        facturesAchat: fa.data.data.length,
        totalRevenue,
        totalPurchases,
        unpaidVente: fv.data.data.filter(f => f.payment_status !== 'paid').length,
        unpaidAchat: fa.data.data.filter(f => f.payment_status !== 'paid').length,
      });
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-wrap"><div className="spinner" /> Loading dashboard…</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Dashboard</h2>
          <p className="page-subtitle">Overview of your stock management system</p>
        </div>
      </div>

      <div className="stats-grid">
        {[
          { icon: '📦', label: 'Products', value: stats.products },
          { icon: '🏷️', label: 'Categories', value: stats.categories },
          { icon: '⭐', label: 'Brands', value: stats.brands },
          { icon: '👥', label: 'Clients', value: stats.clients },
          { icon: '🏭', label: 'Fournisseurs', value: stats.fournisseurs },
          { icon: '🧾', label: 'Sales Invoices', value: stats.facturesVente },
          { icon: '🛒', label: 'Purchase Invoices', value: stats.facturesAchat },
          { icon: '⚠️', label: 'Unpaid Sales', value: stats.unpaidVente },
        ].map(s => (
          <div className="stat-card" key={s.label}>
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card" style={{ padding: '20px 24px' }}>
          <div className="stat-label" style={{ marginBottom: 8 }}>💰 Total Revenue (TTC)</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--success)' }}>
            {stats.totalRevenue.toFixed(2)} TND
          </div>
          <div className="text-muted" style={{ marginTop: 4 }}>across {stats.facturesVente} sales invoices</div>
        </div>
        <div className="card" style={{ padding: '20px 24px' }}>
          <div className="stat-label" style={{ marginBottom: 8 }}>🛒 Total Purchases (TTC)</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent)' }}>
            {stats.totalPurchases.toFixed(2)} TND
          </div>
          <div className="text-muted" style={{ marginTop: 4 }}>across {stats.facturesAchat} purchase invoices</div>
        </div>
      </div>
    </div>
  );
}
