import React from "react";

export function PdfFooter({ companyName }: { companyName?: string }) {
  return (
    <div className="pdf-footer mt-8 pt-4 border-t border-gray-200 text-[9px] text-mute flex justify-between items-center">
      <div>
        <p className="font-bold text-pine-900">FOODOPS — Food & Beverage Control Suite</p>
        {companyName && <p>{companyName}</p>}
        <p>Document généré automatiquement • Confidentiel — Usage Interne</p>
      </div>
      <div className="text-right font-mono">
        <p>Page <span className="page-number">1</span></p>
      </div>
    </div>
  );
}