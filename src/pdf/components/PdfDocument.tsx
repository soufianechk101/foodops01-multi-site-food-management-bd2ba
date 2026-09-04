import React from 'react';

export function PdfDocument({ children }: { children: React.ReactNode }) {
  return (
    <div className="pdf-document" style={{ padding: '0', margin: '0' }}>
      {children}
    </div>
  );
}

export function PdfHeader({ company, title, subtitle }: { company: any; title: string; subtitle?: string }) {
  return (
    <div className="pdf-header" style={{ borderBottom: '2px solid #1b503b', paddingBottom: '16px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1b503b', margin: 0 }}>{company?.name || 'FoodOps'}</h1>
        <p style={{ fontSize: '10px', color: '#666', margin: '4px 0 0 0' }}>{company?.address}, {company?.city}</p>
        <p style={{ fontSize: '10px', color: '#666', margin: '2px 0 0 0' }}>ICE: {company?.ice} | IF: {company?.iff} | RC: {company?.rc}</p>
      </div>
      <div style={{ textAlign: 'right' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1b503b', margin: 0, textTransform: 'uppercase' }}>{title}</h2>
        {subtitle && <p style={{ fontSize: '12px', color: '#666', margin: '4px 0 0 0' }}>{subtitle}</p>}
      </div>
    </div>
  );
}

export function PdfFooter() {
  return (
    <div className="pdf-footer" style={{ marginTop: '40px', paddingTop: '10px', borderTop: '1px solid #eee', fontSize: '8pt', color: '#999', display: 'flex', justifyContent: 'space-between' }}>
      <span>FoodOps — Food & Beverage Control Suite</span>
      <span>Page <span className="page-number"></span></span>
    </div>
  );
}