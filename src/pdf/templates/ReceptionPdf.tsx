import React from 'react';
import { fmtDate, fmtMoney, fmtNum } from '../../lib/util';

export interface ReceptionPdfLine { code: string; name: string; unit: string; ordered: number; received: number; unitCost: number; total: number; }
export interface ReceptionPdfModel {
  number: string; date: string; supplierName: string; siteName: string; poNumber?: string; notes?: string;
  company: { name: string; address?: string; city?: string; ice?: string; iff?: string; rc?: string; phone?: string; email?: string; logo?: string; };
  totalHT: number; lines: ReceptionPdfLine[];
}

export function ReceptionPdf({ model }: { model: ReceptionPdfModel }) {
  return (
    <div className="pdf-document" style={{ fontFamily: '"Public Sans",system-ui,sans-serif', color: '#1a2620', background: 'white', width: '100%' }}>
      <div style={{ height: 3, background: '#102e24', borderRadius: 2, marginBottom: 10, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' as any }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
            {model.company.logo ? (
              <img src={model.company.logo} alt={model.company.name} style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 6, border: '1px solid #e5e7eb', background: 'white' }} />
            ) : (
              <div style={{ width: 36, height: 36, background: '#102e24', color: 'white', border: '1.5px solid #102e24', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, fontWeight: 800, fontSize: 15, fontFamily: '"Space Grotesk",sans-serif', letterSpacing: '-0.02em', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' as any }}>F</div>
            )}
            <div>
              <div style={{ fontWeight: 800, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#102e24', fontFamily: '"Space Grotesk",sans-serif', lineHeight: 1 }}>FOODOPS</div>
              <div style={{ fontSize: 7.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7c8c81', fontWeight: 600 }}>Food & Beverage Control Suite</div>
            </div>
          </div>
          <div style={{ fontWeight: 700, fontSize: 10, color: '#102e24', lineHeight: 1.2 }}>{model.company.name || 'FoodOps Demo'}</div>
          {model.company.address && <div style={{ fontSize: 7.5, color: '#43554b', marginTop: 2 }}>{model.company.address}{model.company.city ? ` · ${model.company.city}` : ''}</div>}
          {(model.company.phone || model.company.email) && <div style={{ fontSize: 7.5, color: '#43554b', marginTop: 2 }}>{model.company.phone ? `Tél. ${model.company.phone}` : ''}{model.company.phone && model.company.email ? ' · ' : ''}{model.company.email ?? ''}</div>}
          {(model.company.ice || model.company.iff || model.company.rc) && <div style={{ fontSize: 6.5, color: '#7c8c81', marginTop: 4, fontFamily: '"IBM Plex Mono",monospace' }}>{model.company.ice ? `ICE ${model.company.ice}` : ''}{model.company.iff ? ` · IF ${model.company.iff}` : ''}{model.company.rc ? ` · RC ${model.company.rc}` : ''}</div>}
        </div>
        <div style={{ textAlign: 'right', minWidth: 175, flexShrink: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#102e24', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: '"Space Grotesk",sans-serif', lineHeight: 1, marginBottom: 8 }}>Bon de réception</div>
          <div style={{ display: 'inline-block', background: '#f0f6f2', border: '1px solid #b9d6c6', borderRadius: 6, padding: '5px 10px', fontFamily: '"IBM Plex Mono",monospace', fontWeight: 700, fontSize: 9, color: '#102e24' }}>{model.number}</div>
          <div style={{ marginTop: 8, fontSize: 7.5, color: '#43554b' }}>Réceptionné le <span style={{ fontWeight: 600, color: '#1a2620' }}>{fmtDate(model.date)}</span></div>
          {model.poNumber && <div style={{ marginTop: 4, fontSize: 7, color: '#43554b' }}>BC associé <span style={{ fontFamily: '"IBM Plex Mono",monospace', fontWeight: 600, color: '#1a2620' }}>{model.poNumber}</span></div>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: model.poNumber ? '1fr 1fr 1fr' : '1fr 1fr', gap: 6, marginBottom: 8 }}>
        {[
          { label: 'Fournisseur', value: model.supplierName || '—' },
          { label: 'Site de réception', value: model.siteName || '—' },
          ...(model.poNumber ? [{ label: 'BC associé', value: model.poNumber }] : []),
        ].map(c => (
          <div key={c.label} style={{ background: '#fbfcfa', border: '1px solid #d9e0d5', borderLeft: '3px solid #1b503b', borderRadius: 6, padding: '7px 9px' }}>
            <div style={{ fontSize: 6.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7c8c81', marginBottom: 3 }}>{c.label}</div>
            <div style={{ fontSize: 8.5, fontWeight: 700, color: '#1a2620', fontFamily: c.label === 'BC associé' ? '"IBM Plex Mono",monospace' : undefined }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ border: '1px solid #d1d5db', borderRadius: 7, overflow: 'hidden', marginBottom: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 7.5 }}>
          <thead>
            <tr style={{ background: '#102e24', color: 'white' }}>
              {['Code', 'Article', 'Unité', 'Commandé', 'Reçu', 'PU HT', 'Total HT'].map((h, i) => (
                <th key={h} style={{ textAlign: i <= 2 ? 'left' : 'right', padding: '6px 6px', fontWeight: 700, fontSize: 6.5, letterSpacing: '0.08em', textTransform: 'uppercase', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' as any }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {model.lines.map((l, i) => {
              const diff = l.received - l.ordered;
              const col = diff > 0 ? '#1e7a4e' : diff < 0 ? '#b8432a' : '#1a2620';
              return (
                <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#f9fafb', borderTop: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '5px 6px', fontFamily: '"IBM Plex Mono",monospace', color: '#43554b', fontSize: 7 }}>{l.code || '—'}</td>
                  <td style={{ padding: '5px 6px', fontWeight: 600, color: '#1a2620' }}>{l.name}</td>
                  <td style={{ padding: '5px 6px', textAlign: 'center', color: '#43554b' }}>{l.unit || '—'}</td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: '"IBM Plex Mono",monospace', color: '#43554b' }}>{fmtNum(l.ordered)}</td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: '"IBM Plex Mono",monospace', fontWeight: 700, color: col }}>{fmtNum(l.received)}</td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: '"IBM Plex Mono",monospace' }}>{fmtMoney(l.unitCost, 'MAD')}</td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: '"IBM Plex Mono",monospace', fontWeight: 700 }}>{fmtMoney(l.total, 'MAD')}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: '#f0f6f2', borderTop: '2px solid #102e24' }}>
              <td colSpan={6} style={{ padding: '7px 6px', textAlign: 'right', fontWeight: 700, fontSize: 7.5, color: '#102e24', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total HT</td>
              <td style={{ padding: '7px 6px', textAlign: 'right', fontFamily: '"IBM Plex Mono",monospace', fontWeight: 800, fontSize: 8.5, color: '#102e24' }}>{fmtMoney(model.totalHT, 'MAD')}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {model.notes && (
        <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderLeft: '3px solid #f59e0b', borderRadius: 5, padding: '6px 8px', marginBottom: 8 }}>
          <div style={{ fontSize: 6.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#92400e', marginBottom: 3 }}>Observations</div>
          <div style={{ fontSize: 7.5, color: '#78350f', lineHeight: 1.5 }}>{model.notes}</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 14, paddingTop: 10, borderTop: '1px solid #e5e7eb' }}>
        {[{ t: 'Réceptionné par', s: 'Magasinier / Réceptionniste' }, { t: 'Validé par', s: 'Responsable stock' }, { t: 'Fournisseur', s: 'Signature et cachet' }].map(b => (
          <div key={b.t}>
            <div style={{ fontSize: 7, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#1a2620', paddingBottom: 6, borderBottom: '1px solid #1a2620', marginBottom: 28 }}>{b.t}</div>
            <div style={{ height: 36, borderBottom: '1px dashed #c5d0c2', marginBottom: 6 }} />
            <div style={{ fontSize: 6.5, color: '#7c8c81' }}>{b.s}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 10, paddingTop: 6, borderTop: '1px solid #d1d5db', display: 'flex', justifyContent: 'space-between', fontSize: 6, color: '#7c8c81', fontFamily: '"IBM Plex Mono",monospace' }}>
        <span>{model.company.name} — Bon de Réception {model.number}</span>
        <span>Généré le {fmtDate(new Date().toISOString())} · Confidentiel</span>
      </div>
    </div>
  );
}
