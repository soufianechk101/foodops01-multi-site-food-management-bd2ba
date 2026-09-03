import React from "react";

export function PdfKpi({
  items,
}: {
  items: { label: string; value: string }[];
}) {
  return (
    <div className="pdf-kpi-grid grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {items.map((kpi, idx) => (
        <div key={idx} className="p-3 border border-gray-200 rounded bg-white">
          <p className="text-[10px] font-bold uppercase tracking-wider text-mute mb-1">
            {kpi.label}
          </p>
          <p className="text-xl font-bold text-pine-900 font-display">{kpi.value}</p>
        </div>
      ))}
    </div>
  );
}