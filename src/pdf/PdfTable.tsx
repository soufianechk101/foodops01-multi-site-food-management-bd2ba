import React from "react";

export interface PdfTableColumn<T = any> {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
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
        <p className="font-semibold">Aucune donnée disponible pour les critères sélectionnés.</p>
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
                  col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
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
            <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/70"}>
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-3 py-2 border-b border-gray-200 break-words ${
                    col.align === "right" 
                      ? "text-right font-mono whitespace-nowrap" 
                      : col.align === "center" 
                      ? "text-center" 
                      : "text-left"
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