import React from 'react';
import { fmtDate, fmtMoney, fmtNum } from '../../lib/util';

export interface ReportPdfColumn { key: string; label: string; align?: 'left' | 'right' | 'center'; }
export interface ReportPdfModel {
  title: string; period: string; scope: string;
  company: { name: string; address?: string; city?: string; ice?: string; iff?: string; rc?: string; logo?: string; };
  columns: ReportPdfColumn[]; rows: Record<string, any>[];
}
const MONETARY_KEYS = new Set(['valeur','total','montant','ca','cout','solde','paye','reste','facture','consommation','valeur_ecart','prix','pu','unitCost']);
const QUANTITY_KEYS = new Set(['qte','quantite','couverts','nb','refs','rupture','compte','theorique','reception','receptions','commande']);
const PERCENT_KEYS = new Set(['part','foodcost','ticket','pct','pourcentage']);
function formatValue(value: any, key: string): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string') {
    const num = Number(value);
    if (!Number.isNaN(num) && value.trim() !== '' && /^\d+(\.\d+)?$/.test(value.trim())) return formatNumericValue(num, key);
    return value;
  }
  if (typeof value === 'number') return formatNumericValue(value, key);
  return String(value);
}
function formatNumericValue(num: number, key: string): string {
  const rounded = Math.round(num * 100) / 100;
  if (MONETARY_KEYS.has(key)) return fmtMoney(rounded, 'MAD');
  if (PERCENT_KEYS.has(key)) { const pct = rounded > 1 ? rounded : rounded * 100; return fmtNum(pct, 1) + ' %'; }
  if (QUANTITY_KEYS.has(key)) return fmtNum(rounded);
  return fmtNum(rounded, 2);
}
export function ReportPdf({ model }: { model: ReportPdfModel }) {
  return (
    <div className="pdf-document" style={{ fontFamily: '"Public Sans",system-ui,sans-serif', color: '#1a2620', background: 'white', width: '100%' }}>
      <div style={{ height: 3, background: '#102e24', borderRadius: 2, marginBottom: 10, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' as any }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
            {model.company.logo ? (
              <img src={model.company.logo} alt={model.company.name} style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 6, border: '1px solid #e5e7eb', background: 'white' }} />
            ) : (
              <div style={{ width: 36, height: 36, background: '#102e24', color: 'white', border: '1.5px solid #102e24', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, fontWeight: 800, fontSize: 15, fontFamily: '"Space Grotesk",sans-serif', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' as any }}>F</div>
            )}
            <div>
              <div style={{ fontWeight: 800, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#102e24', fontFamily: '"Space Grotesk",sans-serif', lineHeight: 1 }}>FOODOPS</div>
              <div style={{ fontSize: 6.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7c8c81', fontWeight: 600 }}>Food & Beverage Control Suite</div>
            </div>
          </div>
          <div style={{ fontWeight: 700, fontSize: 8.5, color: '#102e24' }}>{model.company.name || 'FoodOps'}</div>
          {model.company.address && <div style={{ fontSize: 6.5, color: '#43554b', marginTop: 1 }}>{model.company.address}{model.company.city ? ` · ${model.company.city}` : ''}</div>}
          {(model.company.ice || model.company.iff || model.company.rc) && <div style={{ fontSize: 6, color: '#7c8c81', marginTop: 3, fontFamily: '"IBM Plex Mono",monospace' }}>{model.company.ice ? `ICE ${model.company.ice}` : ''}{model.company.iff ? ` · IF ${model.company.iff}` : ''}{model.company.rc ? ` · RC ${model.company.rc}` : ''}</div>}
        </div>
        <div style={{ textAlign: 'right', minWidth: 165, flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#102e24', letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: '"Space Grotesk",sans-serif', lineHeight: 1.15, marginBottom: 4 }}>{model.title}</div>
          <div style={{ fontSize: 7, color: '#43554b' }}>{model.period}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
        {[
          { k: 'Périmètre', v: model.scope },
          { k: 'Généré le', v: fmtDate(new Date().toISOString()) },
          { k: 'Lignes', v: String(model.rows.length) },
        ].map(c => (
          <div key={c.k} style={{ background: '#fbfcfa', border: '1px solid #d9e0d5', borderLeft: '3px solid #1b503b', borderRadius: 5, padding: '6px 8px' }}>
            <div style={{ fontSize: 6, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#7c8c81', marginBottom: 2 }}>{c.k}</div>
            <div style={{ fontSize: 7.5, fontWeight: 700, color: '#1a2620', lineHeight: 1.2 }}>{c.v}</div>
          </div>
        ))}
      </div>

      {model.rows.length === 0 ? (
        <div style={{ padding: '28px 16px', textAlign: 'center', border: '1px dashed #d1d5db', borderRadius: 6, background: '#f9fafb' }}>
          <div style={{ fontSize: 9, color: '#43554b', fontWeight: 600 }}>Aucune donnée disponible</div>
          <div style={{ fontSize: 7.5, color: '#7c8c81', marginTop: 4 }}>Aucun enregistrement ne correspond aux critères sélectionnés.</div>
        </div>
      ) : (
        <div style={{ border: '1px solid #d1d5db', borderRadius: 7, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 7 }}>
            <thead>
              <tr style={{ background: '#102e24', color: 'white' }}>
                {model.columns.map(col => (
                  <th key={col.key} style={{ textAlign: col.align || 'left', padding: '6px 6px', fontWeight: 700, fontSize: 6, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {model.rows.map((row, idx) => (
                <tr key={idx} style={{ background: idx % 2 === 0 ? 'white' : '#f9fafb', borderTop: '1px solid #e5e7eb' }}>
                  {model.columns.map(col => {
                    const isNum = col.align === 'right' || col.align === 'center';
                    return <td key={col.key} style={{ textAlign: col.align || 'left', padding: '5px 6px', fontFamily: isNum ? '"IBM Plex Mono",monospace' : 'inherit', fontSize: 7, fontWeight: isNum ? 500 : 400, color: '#1a2620' }}>{formatValue(row[col.key], col.key)}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 12, paddingTop: 6, borderTop: '1px solid #d1d5db', display: 'flex', justifyContent: 'space-between', fontSize: 6, color: '#7c8c81', fontFamily: '"IBM Plex Mono",monospace' }}>
        <span>{model.company.name} — {model.title}</span><span>Généré le {fmtDate(new Date().toISOString())} · Confidentiel</span>
      </div>
    </div>
  );
}
