import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface PdfContextType { print: (doc: React.ReactNode) => Promise<void>; isPrinting: boolean; }
const PdfContext = createContext<PdfContextType>({ print: async () => {}, isPrinting: false });

export function PdfPrintProvider({ children }: { children: React.ReactNode }) {
  const [activeDoc, setActiveDoc] = useState<React.ReactNode>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const resolveRef = useRef<(() => void) | null>(null);

  const print = useCallback((doc: React.ReactNode): Promise<void> => {
    if (isPrinting) return Promise.reject(new Error('Impression déjà en cours'));
    return new Promise<void>(resolve => {
      resolveRef.current = resolve;
      setIsPrinting(true);
      setActiveDoc(doc);
    });
  }, [isPrinting]);

  useEffect(() => {
    if (!activeDoc) return;
    const prevTitle = document.title;
    // نحيّد عنوان المتصفح "FoodOps · Pilotage..." باش ما يبانش فوق الورقة
    document.title = '';
    const t = setTimeout(() => {
      try { window.print(); } catch (e) {
        console.error('[PdfPrintManager]', e);
        document.title = prevTitle;
        cleanup();
        resolveRef.current?.();
      }
    }, 320);

    const onAfter = () => { document.title = prevTitle; resolveRef.current?.(); cleanup(); };
    window.addEventListener('afterprint', onAfter, { once: true });

    function cleanup() {
      clearTimeout(t);
      setActiveDoc(null);
      setIsPrinting(false);
      resolveRef.current = null;
      window.removeEventListener('afterprint', onAfter);
    }
    const fallback = setTimeout(() => { if (resolveRef.current) { document.title = prevTitle; resolveRef.current(); cleanup(); } }, 5000);
    return () => { clearTimeout(t); clearTimeout(fallback); window.removeEventListener('afterprint', onAfter); document.title = prevTitle; };
  }, [activeDoc]);

  return (
    <PdfContext.Provider value={{ print, isPrinting }}>
      {children}
      {typeof document !== 'undefined' && activeDoc && createPortal(
        <div id="foodops-pdf-portal" style={{ position: 'absolute', left: -9999, top: 0, width: '210mm', background: 'white', padding: 0, boxSizing: 'border-box' }}>
          {activeDoc}
        </div>,
        document.body
      )}
    </PdfContext.Provider>
  );
}
export const usePdfPrint = () => useContext(PdfContext);
