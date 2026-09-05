import React from 'react';
import { fmtDate, fmtMoney, fmtNum } from '../../lib/util';

export interface ReportPdfColumn {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
}

export interface ReportPdfModel {
  title: string;
  period: string;
  scope: string;
  company: {
    name: string;
    address?: string;
    city?: string;
    ice?: string;
    iff?: string;
    rc?: string;
  };
  columns: ReportPdfColumn[];
  rows: Record<string, any>[];
}

// Clés qui indiquent des valeurs monétaires
const MONETARY_KEYS = new Set([
  'valeur', 'total', 'montant', 'ca', 'cout', 'solde', 'paye', 'reste',
  'facture', 'consommation', 'valeur_ecart', 'prix', 'pu', 'unitCost',
]);

// Clés qui indiquent des quantités
const QUANTITY_KEYS = new Set([
  'qte', 'quantite', 'couverts', 'nb', 'refs', 'rupture', 'compte', 'theorique',
  'reception', 'receptions', 'commande',
]);

// Clés qui indiquent des pourcentages
const PERCENT_KEYS = new Set(['part', 'foodcost', 'ticket', 'pct', 'pourcentage']);

/**
 * Formate intelligemment une valeur selon le type de colonne.
 * Évite les problèmes de floating point (ex: 4.6499999999999995 → 4,65).
 */
function formatValue(value: any, key: string): string {
  if (value === null || value === undefined || value === '') return '—';

  // Si c'est déjà une string formatée
  if (typeof value === 'string') {
    const num = Number(value);
    if (!Number.isNaN(num) && value.trim() !== '' && /^\d+(\.\d+)?$/.test(value.trim())) {
      return formatNumericValue(num, key);
    }
    return value;
  }

  if (typeof value === 'number') {
    return formatNumericValue(value, key);
  }

  return String(value);
}

function formatNumericValue(num: number, key: string): string {
  // Arrondir à 2 décimales pour éviter les problèmes de floating point
  const rounded = Math.round(num * 100) / 100;

  if (MONETARY_KEYS.has(key)) {
    return fmtMoney(rounded, 'MAD');
  }

  if (PERCENT_KEYS.has(key)) {
    // Si c'est déjà un pourcentage (ex: 45.5), on l'affiche tel quel
    // Sinon on suppose que c'est une fraction (ex: 0.455)
    const pct = rounded > 1 ? rounded : rounded * 100;
    return fmtNum(pct, 1) + ' %';
  }

  if (QUANTITY_KEYS.has(key)) {
    return fmtNum(rounded);
  }

  // Valeurs numériques génériques (ex: coûts unitaires)
  return fmtNum(rounded, 2);
}

export function ReportPdf({ model }: { model: ReportPdfModel }) {
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
          {(model.company.ice || model.company.iff || model.company.rc) && (
            <p style={{ fontSize: '8pt', color: '#7c8c81', margin: '4px 0 0 0' }}>
              {model.company.ice && `ICE: ${model.company.ice}`}
              {model.company.iff && ` · IF: ${model.company.iff}`}
              {model.company.rc && ` · RC: ${model.company.rc}`}
            </p>
          )}
        </div>
        <div style={{ textAlign: 'right', minWidth: '220px' }}>
          <h2
            style={{
              fontSize: '16pt',
              fontWeight: 'bold',
              color: '#1b503b',
              margin: '0 0 6px 0',
              textTransform: 'uppercase',
              fontFamily: 'Space Grotesk, sans-serif',
              letterSpacing: '0.05em',
              lineHeight: 1.2,
            }}
          >
            {model.title}
          </h2>
          <p style={{ fontSize: '9pt', color: '#43554b', margin: '2px 0' }}>
            {model.period}
          </p>
        </div>
      </div>

      {/* META */}
      <div
        className="pdf-meta"
        style={{
          marginBottom: '20px',
          padding: '10px 14px',
          background: '#f9fafb',
          borderRadius: '4px',
          border: '1px solid #e5e7eb',
        }}
      >
        <div style={{ display: 'flex', gap: '32px', fontSize: '9pt' }}>
          <div>
            <strong
              style={{
                color: '#7c8c81',
                fontSize: '7.5pt',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                display: 'block',
                marginBottom: '2px',
              }}
            >
              Périmètre
            </strong>
            <p style={{ margin: 0, fontWeight: 600, color: '#1a2620' }}>
              {model.scope}
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
                marginBottom: '2px',
              }}
            >
              Généré le
            </strong>
            <p style={{ margin: 0, fontWeight: 600, color: '#1a2620' }}>
              {fmtDate(new Date().toISOString())}
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
                marginBottom: '2px',
              }}
            >
              Total lignes
            </strong>
            <p style={{ margin: 0, fontWeight: 600, color: '#1a2620' }}>
              {model.rows.length}
            </p>
          </div>
        </div>
      </div>

      {/* TABLE ou EMPTY STATE */}
      {model.rows.length === 0 ? (
        <div
          className="pdf-empty-state"
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            border: '1px dashed #d1d5db',
            borderRadius: '4px',
            background: '#f9fafb',
          }}
        >
          <p
            style={{
              fontSize: '11pt',
              color: '#43554b',
              margin: '0 0 6px 0',
              fontWeight: 600,
            }}
          >
            Aucune donnée disponible
          </p>
          <p style={{ fontSize: '9pt', color: '#7c8c81', margin: 0 }}>
            Aucun enregistrement ne correspond aux critères sélectionnés.
          </p>
        </div>
      ) : (
        <table
          className="pdf-table"
          style={{
            width: '100%',
            marginBottom: '20px',
            fontSize: '8.5pt',
            borderCollapse: 'collapse',
          }}
        >
          <thead>
            <tr style={{ background: '#1b503b', color: 'white' }}>
              {model.columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    textAlign: col.align || 'left',
                    padding: '8px 6px',
                    fontWeight: 600,
                    fontSize: '7.5pt',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    border: 'none',
                  }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {model.rows.map((row, idx) => (
              <tr
                key={idx}
                style={{
                  background: idx % 2 === 0 ? 'white' : '#f9fafb',
                }}
              >
                {model.columns.map((col) => {
                  const isNumeric = col.align === 'right' || col.align === 'center';
                  return (
                    <td
                      key={col.key}
                      style={{
                        textAlign: col.align || 'left',
                        padding: '6px',
                        fontFamily: isNumeric
                          ? 'IBM Plex Mono, monospace'
                          : 'inherit',
                        fontSize: '8.5pt',
                        borderLeft:
                          col === model.columns[0] ? '1px solid #e5e7eb' : 'none',
                        borderRight:
                          col === model.columns[model.columns.length - 1]
                            ? '1px solid #e5e7eb'
                            : 'none',
                        borderTop: '1px solid #e5e7eb',
                        borderBottom: '1px solid #e5e7eb',
                        fontWeight: isNumeric ? 500 : 'normal',
                      }}
                    >
                      {formatValue(row[col.key], col.key)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* FOOTER */}
      <div
        className="pdf-footer"
        style={{
          marginTop: '40px',
          paddingTop: '10px',
          borderTop: '1px solid #d1d5db',
          fontSize: '8pt',
          color: '#7c8c81',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>
          {model.company.name} — {model.title}
        </span>
        <span>
          Généré le {fmtDate(new Date().toISOString())}
        </span>
      </div>
    </div>
  );
}