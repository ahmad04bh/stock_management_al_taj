import { useEffect, useState } from 'react';
import api from '../api';

const BACKEND = 'http://localhost:3000';

const emptyVariantForm = { size_value: '', size_unit: 'L', purchase_price_ht: '', selling_price_ht: '', tax_rate: 19, stock_quantity: 0 };

function Modal({ title, size = '', onClose, onSave, saving, children }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size}`}>
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

// Inline editable row for a single variant
function VariantRow({ variant, productId, onRefresh, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    size_value: variant.size_value || '',
    size_unit: variant.size_unit || 'L',
    purchase_price_ht: variant.purchase_price_ht,
    selling_price_ht: variant.selling_price_ht,
    tax_rate: variant.tax_rate,
    stock_quantity: variant.stock_quantity,
  });
  const [saving, setSaving] = useState(false);

  const sizLabel = variant.size_value ? `${parseFloat(variant.size_value)} ${variant.size_unit}` : 'Default';

  const saveEdit = async () => {
    setSaving(true);
    try {
      await api.put(`/products/${productId}/variants/${variant.id}`, form);
      setEditing(false);
      onRefresh();
    } catch (err) {
      alert(err.response?.data?.error || 'Error saving variant');
    } finally { setSaving(false); }
  };

  if (editing) {
    return (
      <>
        <tr style={{ background: 'var(--bg-hover)' }}>
          <td colSpan={6}>
            <div style={{ padding: '8px 0', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr) auto auto', gap: 8, alignItems: 'end' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.68rem' }}>Size</label>
                <input className="form-input" type="number" placeholder="e.g. 1.5"
                  value={form.size_value} onChange={e => setForm(f => ({ ...f, size_value: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.68rem' }}>Unit</label>
                <input className="form-input" placeholder="L, kg…"
                  value={form.size_unit} onChange={e => setForm(f => ({ ...f, size_unit: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.68rem' }}>Buy HT</label>
                <input className="form-input" type="number" step="0.01"
                  value={form.purchase_price_ht} onChange={e => setForm(f => ({ ...f, purchase_price_ht: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.68rem' }}>Sell HT</label>
                <input className="form-input" type="number" step="0.01"
                  value={form.selling_price_ht} onChange={e => setForm(f => ({ ...f, selling_price_ht: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.68rem' }}>Tax %</label>
                <input className="form-input" type="number"
                  value={form.tax_rate} onChange={e => setForm(f => ({ ...f, tax_rate: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.68rem' }}>Stock</label>
                <input className="form-input" type="number"
                  value={form.stock_quantity} onChange={e => setForm(f => ({ ...f, stock_quantity: e.target.value }))} />
              </div>
              <button className="btn btn-primary btn-sm" onClick={saveEdit} disabled={saving}>{saving ? '…' : '✓'}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>✕</button>
            </div>
          </td>
        </tr>
      </>
    );
  }

  return (
    <tr>
      <td className="td-primary">{sizLabel}</td>
      <td>{parseFloat(variant.purchase_price_ht).toFixed(2)}</td>
      <td>{parseFloat(variant.selling_price_ht).toFixed(2)}</td>
      <td>{parseFloat(variant.tax_rate)}%</td>
      <td>
        <span className={`badge ${variant.stock_quantity > 10 ? 'badge-success' : variant.stock_quantity > 0 ? 'badge-warning' : 'badge-danger'}`}>
          {variant.stock_quantity}
        </span>
      </td>
      <td>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>Edit</button>
          <button className="btn btn-danger btn-sm" onClick={() => onRemove(variant.id)}>Del</button>
        </div>
      </td>
    </tr>
  );
}

export default function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'add' | { product }
  const [detail, setDetail] = useState(null); // product shown in detail panel
  const [form, setForm] = useState({ name: '', category_id: '', brand_id: '', description: '' });
  const [variantForm, setVariantForm] = useState(emptyVariantForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/products'),
      api.get('/categories'),
      api.get('/brands'),
    ]).then(([p, c, b]) => {
      setProducts(p.data.data);
      setCategories(c.data.data);
      setBrands(b.data.data);
    }).finally(() => setLoading(false));
  };

  const loadDetail = async product => {
    const r = await api.get(`/products/${product.id}`);
    setDetail(r.data.data);
  };

  useEffect(load, []);

  const openAdd = () => {
    setForm({ name: '', category_id: categories[0]?.id || '', brand_id: '', description: '' });
    setVariantForm(emptyVariantForm);
    setError(''); setModal('add');
  };

  const openEdit = product => {
    setForm({ name: product.name, category_id: product.category_id, brand_id: product.brand_id || '', description: product.description || '' });
    setError(''); setModal({ product });
  };

  const save = async () => {
    if (!form.name.trim()) return setError('Name is required');
    if (!form.category_id) return setError('Category is required');
    setSaving(true); setError('');
    try {
      if (modal === 'add') {
        const res = await api.post('/products', form);
        const productId = res.data.data.id;
        // Create initial variant
        if (variantForm.selling_price_ht !== '') {
          await api.post(`/products/${productId}/variants`, variantForm);
        }
      } else {
        await api.put(`/products/${modal.product.id}`, form);
      }
      setModal(null); load();
    } catch (e) {
      setError(e.response?.data?.error || 'Error saving');
    } finally { setSaving(false); }
  };

  const remove = async product => {
    if (!confirm(`Delete "${product.name}" and all its variants?`)) return;
    try {
      await api.delete(`/products/${product.id}`);
      if (detail?.id === product.id) setDetail(null);
      load();
    } catch (e) { alert(e.response?.data?.error || 'Cannot delete'); }
  };

  const addVariant = async () => {
    if (!detail) return;
    try {
      await api.post(`/products/${detail.id}/variants`, variantForm);
      setVariantForm(emptyVariantForm);
      loadDetail(detail);
    } catch (e) { alert(e.response?.data?.error || 'Error'); }
  };

  const removeVariant = async variantId => {
    if (!confirm('Delete this variant?')) return;
    try {
      await api.delete(`/products/${detail.id}/variants/${variantId}`);
      loadDetail(detail);
    } catch (e) { alert(e.response?.data?.error || 'Cannot delete'); }
  };

  // Find the brand logo for the detail panel
  const detailBrand = detail ? brands.find(b => b.id === detail.brand_id) : null;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Products</h2>
          <p className="page-subtitle">{products.length} products</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>＋ Add Product</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: detail ? '1fr 460px' : '1fr', gap: 20 }}>
        {/* Product list */}
        <div className="card">
          {loading ? (
            <div className="loading-wrap"><div className="spinner" /> Loading…</div>
          ) : products.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">📦</div><p>No products yet</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th><th>Category</th><th>Brand</th><th style={{width:130}}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => {
                    const brand = brands.find(b => b.id === p.brand_id);
                    return (
                      <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => loadDetail(p)}>
                        <td className="td-primary">{p.name}</td>
                        <td><span className="badge badge-neutral">{p.category_name}</span></td>
                        <td>
                          <div className="flex items-center gap-2">
                            {brand?.logo_path && (
                              <img
                                src={`${BACKEND}/${brand.logo_path}`}
                                alt={brand.name}
                                style={{ width: 20, height: 20, objectFit: 'contain', borderRadius: 3 }}
                              />
                            )}
                            <span className="text-muted">{p.brand_name || '—'}</span>
                          </div>
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <div className="flex gap-2">
                            <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>Edit</button>
                            <button className="btn btn-danger btn-sm" onClick={() => remove(p)}>Del</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {detail && (
          <div className="card" style={{ padding: '20px', alignSelf: 'start' }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
              {detailBrand?.logo_path && (
                <img
                  src={`${BACKEND}/${detailBrand.logo_path}`}
                  alt={detailBrand.name}
                  style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-surface)', padding: 3 }}
                />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{detail.name}</div>
                <div className="text-muted">{detail.category_name} • {detail.brand_name || 'No brand'}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setDetail(null)}>✕</button>
            </div>

            {detail.description && (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                {detail.description}
              </p>
            )}

            <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Variants ({detail.variants?.length || 0})
            </div>

            {detail.variants?.length > 0 && (
              <div className="table-wrap" style={{ marginBottom: 16 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Size</th><th>Buy HT</th><th>Sell HT</th><th>Tax</th><th>Stock</th><th style={{width:100}}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.variants.map(v => (
                      <VariantRow
                        key={v.id}
                        variant={v}
                        productId={detail.id}
                        onRefresh={() => loadDetail(detail)}
                        onRemove={removeVariant}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Add variant form */}
            <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', padding: 14, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase' }}>Add Variant</div>
              <div className="form-grid-2" style={{ marginBottom: 10 }}>
                <div className="form-group">
                  <label className="form-label">Size Value</label>
                  <input className="form-input" type="number" placeholder="1.5" value={variantForm.size_value}
                    onChange={e => setVariantForm(f => ({ ...f, size_value: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Unit</label>
                  <input className="form-input" placeholder="L" value={variantForm.size_unit}
                    onChange={e => setVariantForm(f => ({ ...f, size_unit: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Purchase HT</label>
                  <input className="form-input" type="number" placeholder="0.00" value={variantForm.purchase_price_ht}
                    onChange={e => setVariantForm(f => ({ ...f, purchase_price_ht: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Selling HT</label>
                  <input className="form-input" type="number" placeholder="0.00" value={variantForm.selling_price_ht}
                    onChange={e => setVariantForm(f => ({ ...f, selling_price_ht: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Tax %</label>
                  <input className="form-input" type="number" value={variantForm.tax_rate}
                    onChange={e => setVariantForm(f => ({ ...f, tax_rate: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Initial Stock</label>
                  <input className="form-input" type="number" value={variantForm.stock_quantity}
                    onChange={e => setVariantForm(f => ({ ...f, stock_quantity: e.target.value }))} />
                </div>
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={addVariant}>＋ Add Variant</button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <span className="modal-title">{modal === 'add' ? 'New Product' : 'Edit Product'}</span>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Name *</label>
                  <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Product name" autoFocus />
                </div>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Category *</label>
                    <select className="form-select" value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                      <option value="">Select…</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Brand</label>
                    <select className="form-select" value={form.brand_id} onChange={e => setForm(f => ({ ...f, brand_id: e.target.value }))}>
                      <option value="">None</option>
                      {brands.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-textarea" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description…" />
                </div>
                {modal === 'add' && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12 }}>Initial Variant (optional)</div>
                    <div className="form-grid-2">
                      <div className="form-group">
                        <label className="form-label">Selling Price HT</label>
                        <input className="form-input" type="number" placeholder="0.00" value={variantForm.selling_price_ht}
                          onChange={e => setVariantForm(f => ({ ...f, selling_price_ht: e.target.value }))} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Purchase Price HT</label>
                        <input className="form-input" type="number" placeholder="0.00" value={variantForm.purchase_price_ht}
                          onChange={e => setVariantForm(f => ({ ...f, purchase_price_ht: e.target.value }))} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Tax Rate %</label>
                        <input className="form-input" type="number" value={variantForm.tax_rate}
                          onChange={e => setVariantForm(f => ({ ...f, tax_rate: e.target.value }))} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Initial Stock</label>
                        <input className="form-input" type="number" value={variantForm.stock_quantity}
                          onChange={e => setVariantForm(f => ({ ...f, stock_quantity: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
