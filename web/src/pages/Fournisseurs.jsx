import { useEffect, useState } from 'react';
import api from '../api';

const emptyForm = { name: '', phone: '', address: '', matricule_fiscal: '' };

function Modal({ title, onClose, onSave, saving, children }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

export default function Fournisseurs() {
  const [items, setItems] = useState([]);
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/fournisseurs').then(r => setItems(r.data.data)).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const visible = showInactive ? items : items.filter(i => i.is_active);

  const openAdd = () => { setForm(emptyForm); setError(''); setModal({ mode: 'add' }); };
  const openEdit = item => {
    setForm({ name: item.name, phone: item.phone || '', address: item.address || '', matricule_fiscal: item.matricule_fiscal || '' });
    setError(''); setModal({ mode: 'edit', item });
  };

  const save = async () => {
    if (!form.name.trim()) return setError('Name is required');
    setSaving(true); setError('');
    try {
      if (modal.mode === 'add') await api.post('/fournisseurs', form);
      else await api.put(`/fournisseurs/${modal.item.id}`, form);
      setModal(null); load();
    } catch (e) { setError(e.response?.data?.error || 'Error'); } finally { setSaving(false); }
  };

  const toggleActive = async item => {
    if (item.is_active) {
      if (!confirm(`Deactivate "${item.name}"?`)) return;
      await api.delete(`/fournisseurs/${item.id}`);
    } else {
      // Reactivate: send full data with is_active: true
      await api.put(`/fournisseurs/${item.id}`, {
        name: item.name,
        phone: item.phone || '',
        address: item.address || '',
        matricule_fiscal: item.matricule_fiscal || '',
        is_active: true,
      });
    }
    load();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Fournisseurs</h2>
          <p className="page-subtitle">{items.filter(i => i.is_active).length} active · {items.filter(i => !i.is_active).length} inactive</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={() => setShowInactive(x => !x)}>
            {showInactive ? 'Hide Inactive' : 'Show Inactive'}
          </button>
          <button className="btn btn-primary" onClick={openAdd}>＋ Add Fournisseur</button>
        </div>
      </div>

      <div className="card">
        {loading ? <div className="loading-wrap"><div className="spinner" /> Loading…</div> :
        visible.length === 0 ? <div className="empty-state"><div className="empty-icon">🏭</div><p>No fournisseurs found</p></div> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Phone</th><th>Address</th><th>Matricule</th><th>Status</th><th style={{width:140}}>Actions</th></tr></thead>
              <tbody>
                {visible.map(item => (
                  <tr key={item.id}>
                    <td className="td-primary">{item.name}</td>
                    <td className="text-muted">{item.phone || '—'}</td>
                    <td className="text-muted" style={{ maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.address || '—'}</td>
                    <td className="text-muted">{item.matricule_fiscal || '—'}</td>
                    <td><span className={`badge ${item.is_active ? 'badge-success' : 'badge-neutral'}`}>{item.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(item)}>Edit</button>
                        <button className={`btn btn-sm ${item.is_active ? 'btn-danger' : 'btn-ghost'}`} onClick={() => toggleActive(item)}>
                          {item.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <Modal title={modal.mode === 'add' ? 'New Fournisseur' : 'Edit Fournisseur'} onClose={() => setModal(null)} onSave={save} saving={saving}>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Name *</label>
              <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus placeholder="Supplier name" />
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="71 xxx xxx" />
              </div>
              <div className="form-group">
                <label className="form-label">Matricule Fiscal</label>
                <input className="form-input" value={form.matricule_fiscal} onChange={e => setForm(f => ({ ...f, matricule_fiscal: e.target.value }))} placeholder="Optional" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Address</label>
              <textarea className="form-textarea" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Optional" />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
