import React from 'react';
import { PdfDocument, PdfHeader, PdfFooter } from '../components/PdfDocument';

export interface ReportPdfModel {
  title: string;
  period: string;
  scope: string;
  columns: { key: string; label: string; align?: 'left' | 'right' }[];
  rows: Record<string, any>[];
  company: any;
}

export function ReportPdf({ model }: { model: ReportPdfModel }) {
  return (
    <PdfDocument>
      <PdfHeader company={model.company} title={model.title} subtitle={model.period} />
      
      <div style={{ marginBottom: '16px', fontSize: '9pt', color: '#666' }}>
        <strong>Périmètre:</strong> {model.scope} | <strong>Généré le:</strong> {new Date().toLocaleDateString('fr-FR')}
      </div>

      <table style={{ width: '100%', fontSize: '8pt', marginBottom: '24px' }}>
        <thead>
          <tr style={{ background: '#f3f4f6' }}>
            {model.columns.map(col => (
              <th key={col.key} style={{ textAlign: col.align || 'left', padding: '6px' }}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {model.rows.map((row, idx) => (
            <tr key={idx}>
              {model.columns.map(col => (
                <td key={col.key} style={{ textAlign: col.align || 'left', padding: '4px 6px', borderBottom: '1px solid #eee' }}>
                  {row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <PdfFooter />
    </PdfDocument>
  );
}