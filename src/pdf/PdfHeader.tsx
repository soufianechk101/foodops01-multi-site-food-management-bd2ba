import React from "react";
import type { Company } from "../types";

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
              <h1 className="text-2xl font-bold text-pine-900 tracking-tight font-display">FOODOPS</h1>
              <p className="text-[10px] text-mute uppercase tracking-wider">Food & Beverage Control Suite</p>
            </div>
          </div>
          
          <div className="mt-4 text-sm text-gray-700 space-y-0.5">
            <p className="font-bold text-base text-pine-900">{company.name}</p>
            {company.legalName && <p className="text-xs">{company.legalName}</p>}
            <p>{company.address}, {company.city}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-mute mt-2 font-mono">
              {company.ice && <span>ICE: {company.ice}</span>}
              {company.iff && <span>IF: {company.iff}</span>}
              {company.rc && <span>RC: {company.rc}</span>}
            </div>
          </div>
        </div>

        <div className="text-right">
          <h2 className="text-xl font-bold text-pine-900 uppercase tracking-wide font-display">{title}</h2>
          {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
          <p className="text-xs text-mute mt-3 font-mono">
            Généré le {new Date().toLocaleDateString("fr-FR")}
          </p>
        </div>
      </div>
    </div>
  );
}