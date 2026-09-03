import React from "react";

export function PdfReportMeta({
  items,
}: {
  items: { label: string; value: string }[];
}) {
  const validItems = items.filter((i) => i.value && i.value.trim() !== "");
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