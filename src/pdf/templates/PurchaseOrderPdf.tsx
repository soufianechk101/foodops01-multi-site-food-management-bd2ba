import React from 'react';
import { PdfDocument, PdfHeader, PdfFooter } from '../components/PdfDocument';

export interface PurchaseOrderPdfModel {
  number: string;
  date: string;
  supplierName: string;
  siteName: string;
  status: string;
  expectedDate?: string;
  lines: { code: string; name: string; unit: string; qty: number; unitCost: number; total: number }[];
  totalHT: number;
  notes?: string;
  company: any;
}

export function PurchaseOrderPdf({ model }: { model: PurchaseOrderPdfModel }) {
  return (
    <PdfDocument>
      <PdfHeader company={model.company} title="Bon de Commande" subtitle={`N° ${model.number}`} />
      
      <div style={{ marginBottom: '24px', fontSize: '10pt' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: '#f9fafb', padding: '12px', borderRadius: '4px' }}>
          <div><strong>Fournisseur:</strong> {model.supplierName}</div>
          <div><strong>Site:</strong> {model.siteName}</div>
          <div><strong>Date:</strong> {model.date}</div>
          <div><strong>Statut:</strong> {model.status}</div>
        </div>
      </div>

      <table style={{ width: '100%', fontSize: '9pt', marginBottom: '24px' }}>
        <thead>
          <tr style={{ background: '#f3f4f6' }}>
            <th style={{ textAlign: 'left' }}>Code</th>
            <th style={{ textAlign: 'left' }}>Désignation</th>
            <th style={{ textAlign: 'center' }}>Unité</th>
            <th style={{ textAlign: 'right' }}>Qté</th>
            <th style={{ textAlign: 'right' }}>P.U. HT</th>
            <th style={{ textAlign: 'right' }}>Total HT</th>
          </tr>
        </thead>
        <tbody>
          {model.lines.map((line, idx) => (
            <tr key={idx}>
              <td>{line.code}</td>
              <td>{line.name}</td>
              <td style={{ textAlign: 'center' }}>{line.unit}</td>
              <td style={{ textAlign: 'right' }}>{line.qty}</td>
              <td style={{ textAlign: 'right' }}>{line.unitCost.toFixed(2)}</td>
              <td style={{ textAlign: 'right' }}>{line.total.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ fontWeight: 'bold', background: '#f3f4f6' }}>
            <td colSpan={5} style={{ textAlign: 'right', padding: '8px' }}>Total HT:</td>
            <td style={{ textAlign: 'right', padding: '8px' }}>{model.totalHT.toFixed(2)} MAD</td>
          </tr>
        </tfoot>
      </table>

      {model.notes && (
        <div style={{ marginBottom: '24px', padding: '12px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '4px', fontSize: '9pt' }}>
          <strong>Notes:</strong> {model.notes}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px', marginTop: '40px', fontSize: '9pt' }}>
        <div style={{ borderTop: '1px solid #000', paddingTop: '8px' }}>Demandeur</div>
        <div style={{ borderTop: '1px solid #000', paddingTop: '8px' }}>Service Achats</div>
        <div style={{ borderTop: '1px solid #000', paddingTop: '8px' }}>Fournisseur</div>
      </div>

      <PdfFooter />
    </PdfDocument>
  );
}