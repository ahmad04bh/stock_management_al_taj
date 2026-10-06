import { useEffect, useState } from 'react';
import api from '../api';

function Modal({ title, onClose, onSave, saving, children }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Categories() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // null | { mode: 'add'|'edit', item? }
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/categories').then(r => setItems(r.data.data)).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openAdd = () => { setName(''); setError(''); setModal({ mode: 'add' }); };
  const openEdit = item => { setName(item.name); setError(''); setModal({ mode: 'edit', item }); };

  const save = async () => {
    if (!name.trim()) return setError('Name is required');
    setSaving(true); setError('');
    try {
      if (modal.mode === 'add') await api.post('/categories', { name });
      else await api.put(`/categories/${modal.item.id}`, { name });
      setModal(null); load();
    } catch (e) {
      setError(e.response?.data?.error || 'Error saving');
    } finally { setSaving(false); }
  };

  const remove = async item => {
    if (!confirm(`Delete "${item.name}"?`)) return;
    try {
      await api.delete(`/categories/${item.id}`);
      load();
    } catch (e) {
      alert(e.response?.data?.error || 'Cannot delete');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Categories</h2>
          <p className="page-subtitle">{items.length} categories</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>＋ Add Category</button>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-wrap"><div className="spinner" /> Loading…</div>
        ) : items.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">🏷️</div><p>No categories yet</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>#</th><th>Name</th><th style={{width:120}}>Actions</th></tr></thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id}>
                    <td className="text-muted">{item.id}</td>
                    <td className="td-primary">{item.name}</td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(item)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => remove(item)}>Delete</button>
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
        <Modal
          title={modal.mode === 'add' ? 'New Category' : 'Edit Category'}
          onClose={() => setModal(null)}
          onSave={save}
          saving={saving}
        >
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-group">
            <label className="form-label">Name</label>
            <input
              className="form-input"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && save()}
              autoFocus
              placeholder="e.g. Electronics"
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
