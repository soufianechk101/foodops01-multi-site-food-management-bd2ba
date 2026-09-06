/* ============================================================
   FoodOps — PDF Module Barrel Export
   All shared components exported from a single entry point.
   ============================================================ */

// Layout & Structure
export { PdfLayout, PdfDocument } from './components/PdfDocument';

// Header & Footer
export { PdfHeader } from './components/PdfHeader';
export { PdfFooter } from './components/PdfFooter';

// Content Components
export { PdfTable, type PdfTableColumn } from './components/PdfTable';
export { PdfKpi } from './components/PdfKpi';
export { PdfReportMeta } from './components/PdfReportMeta';

// Print Manager (Portal-based printing)
export { PdfPrintProvider, usePdfPrint } from './components/PdfPrintManager';
