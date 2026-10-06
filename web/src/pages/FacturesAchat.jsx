import { useEffect, useState } from 'react';
import api from '../api';

const STATUS_COLORS = { paid: 'badge-success', unpaid: 'badge-danger', partial: 'badge-warning' };
const emptyLine = () => ({ variant_id: '', quantity: 1, unit_price_ht: '' });

function calcTotals(lines, variants, tvaActive = true) {
  let total_ht = 0, total_ttc = 0;
  for (const line of lines) {
    const v = variants.find(x => String(x.id) === String(line.variant_id));
    if (!v || !line.quantity) continue;
    const price = line.unit_price_ht !== '' ? parseFloat(line.unit_price_ht) : parseFloat(v.purchase_price_ht);
    const tax = tvaActive ? parseFloat(v.tax_rate) : 0;
    const lht = line.quantity * price;
    total_ht += lht;
    total_ttc += lht * (1 + tax / 100);
  }
  return { total_ht, total_ttc, total_tax: total_ttc - total_ht };
}

// ── Print invoice in a new window ────────────────────────────────────
function buildAchatHTML(invoice) {
  if (!invoice) return '';
  const lines = (invoice.lines || []).map(l => `
    <tr>
      <td style="text-align:left;padding:10px 6px;border-bottom:1px solid #ddd">${l.product_name}${l.size_value ? ` ${parseFloat(l.size_value)}${l.size_unit}` : ''}</td>
      <td style="text-align:right;padding:10px 6px;border-bottom:1px solid #ddd">${parseFloat(l.unit_price_ht).toFixed(2)} TND</td>
      <td style="text-align:right;padding:10px 6px;border-bottom:1px solid #ddd">${l.quantity}</td>
      <td style="text-align:right;padding:10px 6px;border-bottom:1px solid #ddd">${parseFloat(l.line_total_ht).toFixed(2)} TND</td>
    </tr>`).join('');

  const tvaRow = invoice.tva_active !== 0
    ? `<div style="display:flex;justify-content:space-between;padding:5px 0"><strong>TVA :</strong><span>${parseFloat(invoice.total_tax).toFixed(2)} TND</span></div>`
    : '';

  const dateStr = new Date(invoice.date).toLocaleDateString('fr-FR');
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>BON DE COMMANDE N°${invoice.id}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #111; padding: 40px; font-size: 14px; line-height: 1.5; }
  .top-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
  .doc-title { font-size: 48px; font-weight: 800; letter-spacing: 3px; text-transform: uppercase; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 8px; }
  .divider { border-bottom: 2px solid #000; margin-bottom: 24px; }
  .parties { display: flex; justify-content: space-between; margin-bottom: 40px; }
  .party-title { font-weight: 700; text-transform: uppercase; margin-bottom: 8px; }
  .destinataire { text-align: right; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
  thead tr { border-bottom: 2px solid #000; }
  th { padding: 10px 6px; font-weight: 700; }
  .totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 60px; }
  .totals { width: 320px; }
  .total-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 16px; border-bottom: 1px solid #eee; }
  .total-row:last-child { font-size: 18px; font-weight: 700; border-bottom: none; }
  .footer { font-size: 10px; color: #555; width: 55%; margin-top: 20px; }
</style></head><body>
  <div class="top-header">
    <svg width="80" height="40" viewBox="0 0 80 40">
      <path d="M10,30 Q15,5 25,35" stroke="#3b82f6" fill="none" stroke-width="2"/>
      <circle cx="40" cy="20" r="10" stroke="#3b82f6" fill="none" stroke-width="2"/>
      <rect x="60" y="10" width="15" height="15" stroke="#3b82f6" fill="none" stroke-width="2"/>
    </svg>
    <div class="doc-title">BON DE COMMANDE</div>
  </div>
  <div class="meta">
    <div><strong>DATE :</strong> ${dateStr} &nbsp;&nbsp; <strong>ÉCHÉANCE :</strong> ${dateStr}</div>
    <div><strong>FACTURE N° : ${invoice.id}</strong></div>
  </div>
  <div class="divider"></div>
  <div class="parties">
    <div><div class="party-title">ÉMETTEUR :</div><strong>${invoice.fournisseur_name || ''}</strong></div>
    <div class="destinataire"><div class="party-title">DESTINATAIRE :</div>Al Taj Stock Management<br>contact@altaj.com<br>123 Business Rd, Tunis, TN 1000</div>
  </div>
  <table>
    <thead><tr>
      <th style="text-align:left">Description</th>
      <th style="text-align:right">Prix Unitaire</th>
      <th style="text-align:right">Quantité</th>
      <th style="text-align:right">Total HT</th>
    </tr></thead>
    <tbody>${lines}<tr><td colspan="4" style="padding:8px 6px;color:#aaa">—</td></tr></tbody>
  </table>
  <div class="totals-wrap"><div class="totals">
    <div class="total-row"><strong>TOTAL HT :</strong><span>${parseFloat(invoice.total_ht).toFixed(2)} TND</span></div>
    ${tvaRow}
    <div class="total-row"><strong>REMISE :</strong><span>—</span></div>
    <div class="total-row"><strong>TOTAL TTC :</strong><span>${parseFloat(invoice.total_ttc).toFixed(2)} TND</span></div>
  </div></div>
  <div class="footer">En cas de retard de paiement, une indemnité de 10% par jour de retard ainsi que des frais de recouvrement de 40 euros seront exigibles.</div>
</body></html>`;
}

export default function FacturesAchat() {
  const [factures, setFactures] = useState([]);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ fournisseur_id: '', payment_status: 'unpaid', amount_paid: 0, tva_active: true });
  const [lines, setLines] = useState([emptyLine()]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/factures-achat'),
      api.get('/fournisseurs?active=true'),
      api.get('/products'),
    ]).then(async ([fa, fo, pr]) => {
      setFactures(fa.data.data);
      setFournisseurs(fo.data.data);
      const allVariants = [];
      for (const p of pr.data.data) {
        const r = await api.get(`/products/${p.id}`);
        for (const v of r.data.data.variants || []) {
          allVariants.push({ ...v, product_name: p.name });
        }
      }
      setVariants(allVariants);
    }).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openAdd = () => {
    setForm({ fournisseur_id: fournisseurs[0]?.id || '', payment_status: 'unpaid', amount_paid: 0, tva_active: true });
    setLines([emptyLine()]); setError(''); setModal('add');
  };

  const openEdit = async f => {
    const r = await api.get(`/factures-achat/${f.id}`);
    const inv = r.data.data;
    setForm({
      fournisseur_id: String(inv.fournisseur_id),
      payment_status: inv.payment_status,
      amount_paid: inv.amount_paid,
      tva_active: inv.tva_active !== 0,
    });
    setLines(inv.lines.map(l => ({
      variant_id: String(l.variant_id),
      quantity: l.quantity,
      unit_price_ht: l.unit_price_ht,
    })));
    setError('');
    setModal({ facture: f });
  };

  const openDetail = async f => {
    const r = await api.get(`/factures-achat/${f.id}`);
    setDetail(r.data.data);
  };

  // When payment_status changes to 'paid', auto-set amount_paid = total
  const handleStatusChange = val => {
    const totals = calcTotals(lines, variants, form.tva_active);
    if (val === 'paid') {
      setForm(f => ({ ...f, payment_status: val, amount_paid: totals.total_ttc.toFixed(2) }));
    } else if (val === 'unpaid') {
      setForm(f => ({ ...f, payment_status: val, amount_paid: 0 }));
    } else {
      setForm(f => ({ ...f, payment_status: val }));
    }
  };

  const save = async () => {
    if (!form.fournisseur_id) return setError('Fournisseur is required');
    const validLines = lines.filter(l => l.variant_id && l.quantity > 0);
    if (!validLines.length) return setError('At least one line required');
    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        lines: validLines.map(l => ({
          variant_id: l.variant_id,
          quantity: Number(l.quantity),
          ...(l.unit_price_ht !== '' ? { unit_price_ht: parseFloat(l.unit_price_ht) } : {}),
        })),
      };
      if (modal === 'add') await api.post('/factures-achat', payload);
      else await api.put(`/factures-achat/${modal.facture.id}`, payload);
      setModal(null); load();
      if (modal !== 'add' && detail?.id === modal.facture.id) {
        const r = await api.get(`/factures-achat/${modal.facture.id}`);
        setDetail(r.data.data);
      }
    } catch (e) { setError(e.response?.data?.error || 'Error'); } finally { setSaving(false); }
  };

  const remove = async f => {
    if (!confirm(`Delete purchase invoice #${f.id}? Stock will be reversed (may be blocked if stock would go negative).`)) return;
    try { await api.delete(`/factures-achat/${f.id}`); if (detail?.id === f.id) setDetail(null); load(); }
    catch (e) { alert(e.response?.data?.error || 'Cannot delete'); }
  };

  const markAsPaid = async () => {
    if (!detail) return;
    try {
      await api.put(`/factures-achat/${detail.id}`, {
        fournisseur_id: detail.fournisseur_id,
        payment_status: 'paid',
        amount_paid: detail.total_ttc,
      });
      const r = await api.get(`/factures-achat/${detail.id}`);
      setDetail(r.data.data);
      load();
    } catch (e) { alert(e.response?.data?.error || 'Error'); }
  };

  const printInvoice = () => {
    if (!detail) return;
    const html = buildAchatHTML(detail);
    const w = window.open('', '_blank', 'width=900,height=700');
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 400);
  };

  const totals = calcTotals(lines, variants, form.tva_active);
  const variantLabel = v => `${v.product_name}${v.size_value ? ` ${parseFloat(v.size_value)}${v.size_unit}` : ''}`;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Factures Achat</h2>
          <p className="page-subtitle">{factures.length} purchase invoices</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>＋ New Purchase</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: detail ? '1fr 440px' : '1fr', gap: 20 }}>
        <div className="card">
          {loading ? <div className="loading-wrap"><div className="spinner" /> Loading…</div> :
          factures.length === 0 ? <div className="empty-state"><div className="empty-icon">🛒</div><p>No purchase invoices yet</p></div> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>#</th><th>Fournisseur</th><th>Date</th><th>HT</th><th>TTC</th><th>Status</th><th style={{width:130}}>Actions</th></tr></thead>
                <tbody>
                  {factures.map(f => (
                    <tr key={f.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(f)}>
                      <td className="text-muted">#{f.id}</td>
                      <td className="td-primary">{f.fournisseur_name}</td>
                      <td className="text-muted">{new Date(f.date).toLocaleDateString()}</td>
                      <td>{parseFloat(f.total_ht).toFixed(2)}</td>
                      <td style={{ fontWeight: 600 }}>{parseFloat(f.total_ttc).toFixed(2)}</td>
                      <td><span className={`badge ${STATUS_COLORS[f.payment_status]}`}>{f.payment_status}</span></td>
                      <td onClick={e => e.stopPropagation()}>
                        <div className="flex gap-2">
                          <button className="btn btn-ghost btn-sm" onClick={() => openEdit(f)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => remove(f)}>Del</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {detail && (
          <div className="card" style={{ padding: 20, alignSelf: 'start' }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>Purchase #{detail.id}</div>
                <div className="text-muted">{detail.fournisseur_name} · {new Date(detail.date).toLocaleDateString()}</div>
              </div>
              <span className={`badge ${STATUS_COLORS[detail.payment_status]}`}>{detail.payment_status}</span>
              <button className="btn btn-ghost btn-sm" onClick={printInvoice} title="Print invoice">🖨️</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setDetail(null)}>✕</button>
            </div>
            <table style={{ marginBottom: 12 }}>
              <thead><tr><th>Product</th><th>Qty</th><th>Unit HT</th><th>Total TTC</th></tr></thead>
              <tbody>
                {detail.lines?.map(l => (
                  <tr key={l.id}>
                    <td className="td-primary">{l.product_name}{l.size_value ? ` ${parseFloat(l.size_value)}${l.size_unit}` : ''}</td>
                    <td>{l.quantity}</td>
                    <td>{parseFloat(l.unit_price_ht).toFixed(2)}</td>
                    <td style={{ fontWeight: 600 }}>{parseFloat(l.line_total_ttc).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="totals-box">
              <div className="totals-row"><span>Total HT</span><span>{parseFloat(detail.total_ht).toFixed(2)} TND</span></div>
              <div className="totals-row"><span>TVA</span><span>{parseFloat(detail.total_tax).toFixed(2)} TND</span></div>
              <div className="totals-row total-ttc"><span>Total TTC</span><span>{parseFloat(detail.total_ttc).toFixed(2)} TND</span></div>
              {detail.payment_status !== 'paid' && (
                <div className="totals-row" style={{ color: 'var(--danger)', marginTop: 4 }}>
                  <span>Remaining</span>
                  <span>{(parseFloat(detail.total_ttc) - parseFloat(detail.amount_paid)).toFixed(2)} TND</span>
                </div>
              )}
            </div>
            {detail.payment_status !== 'paid' && (
              <button
                className="btn btn-primary"
                style={{ width: '100%', marginTop: 12, background: 'var(--success)' }}
                onClick={markAsPaid}
              >
                ✓ Mark as Paid
              </button>
            )}
          </div>
        )}
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal modal-xl">
            <div className="modal-header">
              <span className="modal-title">{modal === 'add' ? 'New Purchase Invoice' : `Edit Purchase #${modal.facture.id}`}</span>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}
              <div className="form-grid-2" style={{ marginBottom: 16 }}>
                <div className="form-group">
                  <label className="form-label">Fournisseur *</label>
                  <select className="form-select" value={form.fournisseur_id} onChange={e => setForm(f => ({ ...f, fournisseur_id: e.target.value }))}>
                    <option value="">Select fournisseur…</option>
                    {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Status</label>
                  <select className="form-select" value={form.payment_status} onChange={e => handleStatusChange(e.target.value)}>
                    <option value="unpaid">Unpaid</option>
                    <option value="partial">Partial</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
                {form.payment_status === 'partial' && (
                  <div className="form-group">
                    <label className="form-label">Amount Paid (TND)</label>
                    <input className="form-input" type="number" value={form.amount_paid} onChange={e => setForm(f => ({ ...f, amount_paid: e.target.value }))} />
                  </div>
                )}
                {form.payment_status === 'paid' && (
                  <div className="form-group">
                    <label className="form-label">Amount Paid (TND)</label>
                    <input className="form-input" type="number" value={totals.total_ttc.toFixed(2)} readOnly style={{ opacity: 0.6 }} />
                    <span className="form-hint">Auto-set to total TTC</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
                <label className="switch">
                  <input type="checkbox" checked={form.tva_active} onChange={e => setForm(f => ({ ...f, tva_active: e.target.checked }))} />
                  <span className="slider round"></span>
                </label>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Apply TVA (Tax)</span>
              </div>

              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 10 }}>Line Items</div>
              {lines.map((line, i) => (
                <div key={i} className="line-row">
                  <div className="form-group">
                    <select className="form-select" value={line.variant_id} onChange={e => setLines(ls => ls.map((l, j) => j === i ? { ...l, variant_id: e.target.value } : l))}>
                      <option value="">Select variant…</option>
                      {variants.map(v => <option key={v.id} value={v.id}>{variantLabel(v)}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <input className="form-input" type="number" min="1" placeholder="Qty" value={line.quantity}
                      onChange={e => setLines(ls => ls.map((l, j) => j === i ? { ...l, quantity: e.target.value } : l))} />
                  </div>
                  <div className="form-group">
                    <input className="form-input" type="number" placeholder="Price HT (opt)" value={line.unit_price_ht}
                      onChange={e => setLines(ls => ls.map((l, j) => j === i ? { ...l, unit_price_ht: e.target.value } : l))} />
                  </div>
                  <button className="btn btn-danger btn-icon" onClick={() => setLines(ls => ls.filter((_, j) => j !== i))} disabled={lines.length === 1}>✕</button>
                </div>
              ))}
              <button className="add-line-btn" onClick={() => setLines(ls => [...ls, emptyLine()])}>＋ Add Line</button>

              <div className="totals-box">
                <div className="totals-row"><span>Total HT</span><span>{totals.total_ht.toFixed(2)} TND</span></div>
                <div className="totals-row"><span>TVA</span><span>{totals.total_tax.toFixed(2)} TND</span></div>
                <div className="totals-row total-ttc"><span>Total TTC</span><span>{totals.total_ttc.toFixed(2)} TND</span></div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : modal === 'add' ? 'Create Purchase' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden print area */}
      <PrintInvoice invoice={detail} />
    </div>
  );
}
