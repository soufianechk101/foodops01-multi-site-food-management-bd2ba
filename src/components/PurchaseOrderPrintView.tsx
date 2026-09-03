import { fmtMoney, fmtNum } from "../lib/util";
import type { PurchaseOrder, Product, Supplier, Company } from "../types";

export function PurchaseOrderPrintView({
  po,
  supplier,
  products,
  company,
}: {
  po: PurchaseOrder;
  supplier: Supplier;
  products: Product[];
  company: Company;
}) {
  const totalHT = po.lines.reduce((sum, l) => sum + l.qty * l.unitCost, 0);
  const totalTVA = po.lines.reduce((sum, l) => sum + (l.qty * l.unitCost * l.vatRate) / 100, 0);
  const totalTTC = totalHT + totalTVA;

  return (
    <div className="print-root p-8 bg-white text-black font-sans">
      {/* Header: Company Info & Document Title */}
      <div className="flex justify-between items-start border-b-2 border-gray-800 pb-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-wide">{company.name}</h1>
          <p className="text-sm text-gray-600 mt-1">{company.address}</p>
          <p className="text-sm text-gray-600">{company.city} - {company.country}</p>
          <p className="text-sm text-gray-600 mt-2">
            <span className="font-semibold">ICE:</span> {company.ice} | <span className="font-semibold">RC:</span> {company.rc}
          </p>
        </div>
        <div className="text-right">
          <h2 className="text-3xl font-bold text-gray-900 uppercase">Bon de Commande</h2>
          <p className="text-lg font-semibold mt-2">N° {po.number}</p>
          <p className="text-sm text-gray-600">Date: {po.date}</p>
        </div>
      </div>

      {/* Supplier Info */}
      <div className="mb-8 p-4 border border-gray-300 rounded bg-gray-50">
        <h3 className="text-sm font-bold uppercase text-gray-500 mb-2">Fournisseur</h3>
        <p className="text-base font-bold text-gray-900">{supplier.name}</p>
        <p className="text-sm text-gray-700">{supplier.address}, {supplier.city}</p>
        <p className="text-sm text-gray-700">Tél: {supplier.phone} | Email: {supplier.email}</p>
        <p className="text-sm text-gray-700 mt-1">ICE: {supplier.ice}</p>
      </div>

      {/* Items Table */}
      <table className="w-full border-collapse border border-gray-400 mb-6 text-sm">
        <thead>
          <tr className="bg-gray-100 text-gray-800">
            <th className="border border-gray-400 px-3 py-2 text-left w-16">Code</th>
            <th className="border border-gray-400 px-3 py-2 text-left">Désignation</th>
            <th className="border border-gray-400 px-3 py-2 text-center w-20">Qté</th>
            <th className="border border-gray-400 px-3 py-2 text-center w-20">Unité</th>
            <th className="border border-gray-400 px-3 py-2 text-right w-28">P.U. HT</th>
            <th className="border border-gray-400 px-3 py-2 text-right w-28">TVA %</th>
            <th className="border border-gray-400 px-3 py-2 text-right w-32">Total HT</th>
          </tr>
        </thead>
        <tbody>
          {po.lines.map((line, idx) => {
            const product = products.find((p) => p.id === line.productId);
            const lineTotal = line.qty * line.unitCost;
            return (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="border border-gray-400 px-3 py-2 font-mono text-xs">{product?.code || "-"}</td>
                <td className="border border-gray-400 px-3 py-2 font-medium">{product?.name || "Produit inconnu"}</td>
                <td className="border border-gray-400 px-3 py-2 text-center">{fmtNum(line.qty)}</td>
                <td className="border border-gray-400 px-3 py-2 text-center">{product?.unitId || "-"}</td>
                <td className="border border-gray-400 px-3 py-2 text-right">{fmtNum(line.unitCost)}</td>
                <td className="border border-gray-400 px-3 py-2 text-right">{line.vatRate}%</td>
                <td className="border border-gray-400 px-3 py-2 text-right font-semibold">{fmtMoney(lineTotal, company.currency)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end mb-8">
        <div className="w-72">
          <div className="flex justify-between py-1 border-b border-gray-300">
            <span className="text-gray-600">Total HT:</span>
            <span className="font-semibold">{fmtMoney(totalHT, company.currency)}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-gray-300">
            <span className="text-gray-600">TVA:</span>
            <span className="font-semibold">{fmtMoney(totalTVA, company.currency)}</span>
          </div>
          <div className="flex justify-between py-2 text-lg font-bold text-gray-900 border-t-2 border-gray-800 mt-1">
            <span>Total TTC:</span>
            <span>{fmtMoney(totalTTC, company.currency)}</span>
          </div>
        </div>
      </div>

      {/* Footer / Signatures */}
      <div className="mt-12 pt-4 border-t border-gray-300">
        <p className="text-sm text-gray-600 mb-8 italic">
          Arrêté le présent bon de commande à la somme de : <span className="font-bold text-gray-900">{fmtMoney(totalTTC, company.currency)}</span>
        </p>
        <div className="flex justify-between text-sm">
          <div className="w-1/3">
            <p className="font-bold mb-8 border-b border-gray-400 pb-1">Cachet et Signature du Fournisseur</p>
            <p className="text-xs text-gray-500">(Lu et approuvé)</p>
          </div>
          <div className="w-1/3">
            <p className="font-bold mb-8 border-b border-gray-400 pb-1">Service des Achats</p>
            <p className="text-xs text-gray-500">Visa et validation</p>
          </div>
        </div>
      </div>
      
      {/* Print timestamp (discreet) */}
      <div className="mt-8 text-[10px] text-gray-400 text-center">
        Document généré le {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR')} via FoodOps
      </div>
    </div>
  );
}