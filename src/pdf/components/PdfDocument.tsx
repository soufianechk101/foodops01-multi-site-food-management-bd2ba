import React from 'react';
import type { Company } from '../../types';

/* ============================================================
   FoodOps — PDF Components
   All shared PDF components live in one place.
   ============================================================ */

/* ---------- Layout ---------- */
export function PdfLayout({
  children,
  orientation = 'portrait',
  className,
}: {
  children: React.ReactNode;
  orientation?: 'portrait' | 'landscape';
  className?: string;
}) {
  return (
    <div
      className={`pdf-root ${orientation === 'landscape' ? 'pdf-landscape' : ''} ${className || ''}`}
    >
      {children}
    </div>
  );
}

/* ---------- Header ---------- */
export function PdfHeader({
  company,
  title,
  subtitle,
}: {
  company: Company;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="pdf-header mb-6 pb-4 border-b-2 border-pine-900">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-pine-900 text-white flex items-center justify-center rounded font-bold text-xl font-display">
              F
            </div>
            <div>
              <h1 className="text-2xl font-bold text-pine-900 tracking-tight font-display">
                FOODOPS
              </h1>
              <p className="text-[10px] text-mute uppercase tracking-wider">
                Food & Beverage Control Suite
              </p>
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-700 space-y-0.5">
            <p className="font-bold text-base text-pine-900">{company.name}</p>
            {company.legalName && (
              <p className="text-xs">{company.legalName}</p>
            )}
            <p>
              {company.address}, {company.city}
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-mute mt-2 font-mono">
              {company.ice && <span>ICE: {company.ice}</span>}
              {company.iff && <span>IF: {company.iff}</span>}
              {company.rc && <span>RC: {company.rc}</span>}
            </div>
          </div>
        </div>

        <div className="text-right">
          <h2 className="text-xl font-bold text-pine-900 uppercase tracking-wide font-display">
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
          )}
          <p className="text-xs text-mute mt-3 font-mono">
            Généré le {new Date().toLocaleDateString('fr-FR')}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------- Footer ---------- */
export function PdfFooter({
  companyName,
}: {
  companyName?: string;
}) {
  return (
    <div className="pdf-footer mt-8 pt-4 border-t border-gray-200 text-[9px] text-mute flex justify-between items-center">
      <div>
        <p className="font-bold text-pine-900">
          FOODOPS — Food & Beverage Control Suite
        </p>
        {companyName && <p>{companyName}</p>}
        <p>
          Document généré automatiquement • Confidentiel — Usage Interne
        </p>
      </div>
      <div className="text-right font-mono">
        <p>
          Page <span className="page-number">1</span>
        </p>
      </div>
    </div>
  );
}

/* ---------- Document Wrapper ---------- */
export function PdfDocument({ children }: { children: React.ReactNode }) {
  return (
    <div className="pdf-document" style={{ padding: 0, margin: 0 }}>
      {children}
    </div>
  );
}

/* ---------- Table ---------- */
export interface PdfTableColumn<T = any> {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  width?: string;
  render?: (row: T) => React.ReactNode;
}

export function PdfTable<T = any>({
  columns,
  rows,
  footer,
}: {
  columns: PdfTableColumn<T>[];
  rows: T[];
  footer?: React.ReactNode;
}) {
  if (!rows || rows.length === 0) {
    return (
      <div className="p-8 text-center text-mute border border-dashed border-gray-300 rounded bg-white my-6">
        <p className="font-semibold">
          Aucune donnée disponible pour les critères sélectionnés.
        </p>
      </div>
    );
  }

  return (
    <div className="pdf-table-container overflow-hidden border border-gray-300 rounded my-6 bg-white">
      <table className="w-full text-[10px] print:text-[9pt]">
        <thead className="bg-gray-100 text-gray-700">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-3 py-2.5 font-bold uppercase tracking-wider border-b-2 border-gray-300 ${
                  col.align === 'right'
                    ? 'text-right'
                    : col.align === 'center'
                    ? 'text-center'
                    : 'text-left'
                }`}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white">
          {rows.map((row, idx) => (
            <tr
              key={idx}
              className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/70'}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-3 py-2 border-b border-gray-200 break-words ${
                    col.align === 'right'
                      ? 'text-right font-mono whitespace-nowrap'
                      : col.align === 'center'
                      ? 'text-center'
                      : 'text-left'
                  }`}
                >
                  {col.render ? col.render(row) : (row as any)[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && (
          <tfoot className="bg-gray-100 font-bold text-pine-900">
            {footer}
          </tfoot>
        )}
      </table>
    </div>
  );
}

/* ---------- KPI Grid ---------- */
export function PdfKpi({
  items,
}: {
  items: { label: string; value: string }[];
}) {
  return (
    <div className="pdf-kpi-grid grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {items.map((kpi, idx) => (
        <div
          key={idx}
          className="p-3 border border-gray-200 rounded bg-white"
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-mute mb-1">
            {kpi.label}
          </p>
          <p className="text-xl font-bold text-pine-900 font-display">
            {kpi.value}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ---------- Report Meta ---------- */
export function PdfReportMeta({
  items,
}: {
  items: { label: string; value: string }[];
}) {
  const validItems = items.filter((i) => i.value && i.value.trim() !== '');
  if (validItems.length === 0) return null;

  return (
    <div className="pdf-meta mb-6 p-3 bg-gray-50 border border-gray-200 rounded text-sm">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {validItems.map((item, idx) => (
          <div key={idx}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-mute mb-0.5">
              {item.label}
            </p>
            <p className="font-semibold text-ink">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
