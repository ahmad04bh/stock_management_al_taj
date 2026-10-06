import { useEffect, useState } from 'react';
import api from '../api';

const BACKEND = 'http://localhost:3000';

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

export default function Brands() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(null); // brand id being uploaded

  const load = () => {
    setLoading(true);
    api.get('/brands').then(r => setItems(r.data.data)).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openAdd = () => { setName(''); setError(''); setModal({ mode: 'add' }); };
  const openEdit = item => { setName(item.name); setError(''); setModal({ mode: 'edit', item }); };

  const save = async () => {
    if (!name.trim()) return setError('Name is required');
    setSaving(true); setError('');
    try {
      if (modal.mode === 'add') await api.post('/brands', { name });
      else await api.put(`/brands/${modal.item.id}`, { name });
      setModal(null); load();
    } catch (e) {
      setError(e.response?.data?.error || 'Error saving');
    } finally { setSaving(false); }
  };

  const remove = async item => {
    if (!confirm(`Delete "${item.name}"?`)) return;
    try {
      await api.delete(`/brands/${item.id}`);
      load();
    } catch (e) {
      alert(e.response?.data?.error || 'Cannot delete');
    }
  };

  const uploadLogo = async (item, file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('logo', file);
    setUploading(item.id);
    try {
      await api.post(`/brands/${item.id}/logo`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      load();
    } catch (e) {
      alert(e.response?.data?.error || 'Upload failed');
    } finally { setUploading(null); }
  };

  const deleteLogo = async item => {
    try {
      await api.delete(`/brands/${item.id}/logo`);
      load();
    } catch (e) { alert(e.response?.data?.error || 'Error'); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Brands</h2>
          <p className="page-subtitle">{items.length} brands</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>＋ Add Brand</button>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-wrap"><div className="spinner" /> Loading…</div>
        ) : items.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">⭐</div><p>No brands yet</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th style={{width:56}}>Logo</th><th>#</th><th>Name</th><th style={{width:160}}>Actions</th></tr></thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id}>
                    <td>
                      {item.logo_path ? (
                        <div className="flex items-center gap-2">
                          <img
                            src={`${BACKEND}/${item.logo_path}`}
                            alt={item.name}
                            style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
                          />
                          <button
                            className="btn btn-danger btn-sm"
                            title="Remove logo"
                            onClick={() => deleteLogo(item)}
                          >✕</button>
                        </div>
                      ) : (
                        <label style={{ cursor: 'pointer' }} title="Upload logo">
                          <span className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem' }}>
                            {uploading === item.id ? '…' : '📷'}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={e => uploadLogo(item, e.target.files[0])}
                          />
                        </label>
                      )}
                    </td>
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
          title={modal.mode === 'add' ? 'New Brand' : 'Edit Brand'}
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
              placeholder="e.g. Samsung"
            />
          </div>
          {modal.mode === 'edit' && modal.item && (
            <div className="form-group" style={{ marginTop: 16 }}>
              <label className="form-label">Logo</label>
              {modal.item.logo_path ? (
                <div className="flex items-center gap-2" style={{ marginTop: 4 }}>
                  <img
                    src={`${BACKEND}/${modal.item.logo_path}`}
                    alt="logo"
                    style={{ width: 60, height: 60, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)', padding: 4 }}
                  />
                  <div className="flex" style={{ flexDirection: 'column', gap: 6 }}>
                    <label style={{ cursor: 'pointer' }}>
                      <span className="btn btn-ghost btn-sm">Replace</span>
                      <input
                        type="file" accept="image/*" style={{ display: 'none' }}
                        onChange={e => { uploadLogo(modal.item, e.target.files[0]); load(); }}
                      />
                    </label>
                    <button className="btn btn-danger btn-sm" onClick={() => { deleteLogo(modal.item); load(); }}>Remove</button>
                  </div>
                </div>
              ) : (
                <label style={{ cursor: 'pointer', display: 'block', marginTop: 4 }}>
                  <div className="photo-upload-area">
                    {uploading === modal.item.id ? 'Uploading…' : '📷 Upload logo (optional)'}
                  </div>
                  <input
                    type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => uploadLogo(modal.item, e.target.files[0])}
                  />
                </label>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
