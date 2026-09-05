import React from 'react';
import { fmtDate, fmtMoney, fmtNum } from '../../lib/util';

export interface PurchaseOrderPdfLine {
  code: string;
  name: string;
  unit: string;
  qty: number;
  unitCost: number;
  total: number;
}

export interface PurchaseOrderPdfModel {
  number: string;
  date: string;
  supplierName: string;
  siteName: string;
  status: string;
  expectedDate?: string;
  notes?: string;
  company: {
    name: string;
    address?: string;
    city?: string;
    ice?: string;
    iff?: string;
    rc?: string;
    phone?: string;
    email?: string;
  };
  totalHT: number;
  lines: PurchaseOrderPdfLine[];
}

const STATUS_LABELS: Record<string, string> = {
  brouillon: 'Brouillon',
  soumis: 'Soumis',
  approuve: 'Approuvé',
  partiel: 'Partiel',
  annule: 'Annulé',
  cloture: 'Clôturé',
};

export function PurchaseOrderPdf({ model }: { model: PurchaseOrderPdfModel }) {
  const statusLabel = STATUS_LABELS[model.status] || model.status;

  return (
    <div className="pdf-document">
      {/* HEADER */}
      <div
        className="pdf-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '20px',
          paddingBottom: '16px',
          borderBottom: '2px solid #1b503b',
        }}
      >
        <div style={{ flex: 1 }}>
          <h1
            style={{
              fontSize: '22pt',
              fontWeight: 'bold',
              color: '#1b503b',
              margin: '0 0 6px 0',
              fontFamily: 'Space Grotesk, sans-serif',
              letterSpacing: '-0.02em',
            }}
          >
            {model.company.name || 'FoodOps'}
          </h1>
          {model.company.address && (
            <p style={{ fontSize: '9pt', color: '#43554b', margin: '2px 0' }}>
              {model.company.address}
              {model.company.city ? `, ${model.company.city}` : ''}
            </p>
          )}
          {(model.company.phone || model.company.email) && (
            <p style={{ fontSize: '9pt', color: '#43554b', margin: '2px 0' }}>
              {model.company.phone && `Tél: ${model.company.phone}`}
              {model.company.phone && model.company.email && ' · '}
              {model.company.email && model.company.email}
            </p>
          )}
          {(model.company.ice || model.company.iff || model.company.rc) && (
            <p style={{ fontSize: '8pt', color: '#7c8c81', margin: '4px 0 0 0' }}>
              {model.company.ice && `ICE: ${model.company.ice}`}
              {model.company.iff && ` · IF: ${model.company.iff}`}
              {model.company.rc && ` · RC: ${model.company.rc}`}
            </p>
          )}
        </div>
        <div style={{ textAlign: 'right', minWidth: '200px' }}>
          <h2
            style={{
              fontSize: '18pt',
              fontWeight: 'bold',
              color: '#1b503b',
              margin: '0 0 6px 0',
              textTransform: 'uppercase',
              fontFamily: 'Space Grotesk, sans-serif',
              letterSpacing: '0.05em',
            }}
          >
            Bon de Commande
          </h2>
          <p
            style={{
              fontSize: '11pt',
              fontFamily: 'IBM Plex Mono, monospace',
              color: '#1b503b',
              margin: '2px 0',
              fontWeight: 600,
            }}
          >
            N° {model.number}
          </p>
          <p style={{ fontSize: '9pt', color: '#43554b', margin: '2px 0' }}>
            Date: {fmtDate(model.date)}
          </p>
          {model.expectedDate && (
            <p style={{ fontSize: '9pt', color: '#43554b', margin: '2px 0' }}>
              Livraison prévue: {fmtDate(model.expectedDate)}
            </p>
          )}
        </div>
      </div>

      {/* META */}
      <div
        className="pdf-meta"
        style={{
          marginBottom: '20px',
          padding: '12px 14px',
          background: '#f9fafb',
          borderRadius: '4px',
          border: '1px solid #e5e7eb',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '16px',
            fontSize: '9pt',
          }}
        >
          <div>
            <strong
              style={{
                color: '#7c8c81',
                fontSize: '7.5pt',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                display: 'block',
                marginBottom: '3px',
              }}
            >
              Fournisseur
            </strong>
            <p style={{ margin: 0, fontWeight: 600, color: '#1a2620' }}>
              {model.supplierName}
            </p>
          </div>
          <div>
            <strong
              style={{
                color: '#7c8c81',
                fontSize: '7.5pt',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                display: 'block',
                marginBottom: '3px',
              }}
            >
              Site livré
            </strong>
            <p style={{ margin: 0, fontWeight: 600, color: '#1a2620' }}>
              {model.siteName}
            </p>
          </div>
          <div>
            <strong
              style={{
                color: '#7c8c81',
                fontSize: '7.5pt',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                display: 'block',
                marginBottom: '3px',
              }}
            >
              Statut
            </strong>
            <p style={{ margin: 0, fontWeight: 600, color: '#1a2620', textTransform: 'capitalize' }}>
              {statusLabel}
            </p>
          </div>
        </div>
      </div>

      {/* ITEMS TABLE */}
      <table
        className="pdf-table"
        style={{
          width: '100%',
          marginBottom: '20px',
          fontSize: '9pt',
          borderCollapse: 'collapse',
        }}
      >
        <thead>
          <tr style={{ background: '#1b503b', color: 'white' }}>
            <th style={{ textAlign: 'left', padding: '8px 6px', fontWeight: 600, fontSize: '8pt', textTransform: 'uppercase', letterSpacing: '0.05em', border: 'none' }}>Code</th>
            <th style={{ textAlign: 'left', padding: '8px 6px', fontWeight: 600, fontSize: '8pt', textTransform: 'uppercase', letterSpacing: '0.05em', border: 'none' }}>Désignation</th>
            <th style={{ textAlign: 'center', padding: '8px 6px', fontWeight: 600, fontSize: '8pt', textTransform: 'uppercase', letterSpacing: '0.05em', border: 'none' }}>Unité</th>
            <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600, fontSize: '8pt', textTransform: 'uppercase', letterSpacing: '0.05em', border: 'none' }}>Quantité</th>
            <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600, fontSize: '8pt', textTransform: 'uppercase', letterSpacing: '0.05em', border: 'none' }}>PU HT</th>
            <th style={{ textAlign: 'right', padding: '8px 6px', fontWeight: 600, fontSize: '8pt', textTransform: 'uppercase', letterSpacing: '0.05em', border: 'none' }}>Total HT</th>
          </tr>
        </thead>
        <tbody>
          {model.lines.map((line, idx) => (
            <tr key={idx} style={{ background: idx % 2 === 0 ? 'white' : '#f9fafb' }}>
              <td style={{ padding: '7px 6px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '8.5pt', color: '#43554b', borderLeft: '1px solid #e5e7eb', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
                {line.code || '—'}
              </td>
              <td style={{ padding: '7px 6px', fontWeight: 500, borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
                {line.name}
              </td>
              <td style={{ padding: '7px 6px', textAlign: 'center', color: '#43554b', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
                {line.unit || '—'}
              </td>
              <td style={{ padding: '7px 6px', textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
                {fmtNum(line.qty)}
              </td>
              <td style={{ padding: '7px 6px', textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
                {fmtMoney(line.unitCost, 'MAD')}
              </td>
              <td style={{ padding: '7px 6px', textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600, borderRight: '1px solid #e5e7eb', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
                {fmtMoney(line.total, 'MAD')}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: '#f3f4f6', fontWeight: 600 }}>
            <td colSpan={5} style={{ padding: '10px 6px', textAlign: 'right', fontSize: '10pt', borderLeft: '1px solid #d1d5db', borderTop: '2px solid #1b503b', borderBottom: '1px solid #d1d5db' }}>
              Total HT
            </td>
            <td style={{ padding: '10px 6px', textAlign: 'right', fontSize: '11pt', fontFamily: 'IBM Plex Mono, monospace', color: '#1b503b', fontWeight: 700, borderRight: '1px solid #d1d5db', borderTop: '2px solid #1b503b', borderBottom: '1px solid #d1d5db' }}>
              {fmtMoney(model.totalHT, 'MAD')}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* NOTES */}
      {model.notes && (
        <div className="pdf-section" style={{ marginBottom: '20px', padding: '10px 12px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '4px' }}>
          <strong style={{ fontSize: '8pt', color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '4px' }}>
            Notes / Réserves
          </strong>
          <p style={{ margin: 0, fontSize: '9pt', color: '#78350f' }}>
            {model.notes}
          </p>
        </div>
      )}

      {/* SIGNATURES */}
      <div className="pdf-signatures" style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px', fontSize: '9pt' }}>
          <div>
            <p style={{ fontWeight: 600, marginBottom: '40px', paddingBottom: '6px', borderBottom: '1px solid #1a2620' }}>Demandeur</p>
            <p style={{ fontSize: '8pt', color: '#7c8c81', margin: 0 }}>Nom et signature</p>
          </div>
          <div>
            <p style={{ fontWeight: 600, marginBottom: '40px', paddingBottom: '6px', borderBottom: '1px solid #1a2620' }}>Service Achats</p>
            <p style={{ fontSize: '8pt', color: '#7c8c81', margin: 0 }}>Visa et validation</p>
          </div>
          <div>
            <p style={{ fontWeight: 600, marginBottom: '40px', paddingBottom: '6px', borderBottom: '1px solid #1a2620' }}>Fournisseur</p>
            <p style={{ fontSize: '8pt', color: '#7c8c81', margin: 0 }}>Lu et approuvé</p>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="pdf-footer" style={{ marginTop: '40px', paddingTop: '10px', borderTop: '1px solid #d1d5db', fontSize: '8pt', color: '#7c8c81', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{model.company.name} — Bon de Commande N° {model.number}</span>
        <span>Généré le {fmtDate(new Date().toISOString())}</span>
      </div>
    </div>
  );
}