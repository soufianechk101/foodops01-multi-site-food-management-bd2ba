import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './PdfStyles.css';

interface PdfContextType {
  print: (document: React.ReactNode) => Promise<void>;
  isPrinting: boolean;
}

const PdfContext = createContext<PdfContextType>({
  print: async () => {},
  isPrinting: false,
});

export function PdfPrintProvider({ children }: { children: React.ReactNode }) {
  const [activeDocument, setActiveDocument] = useState<React.ReactNode>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const resolveRef = useRef<(() => void) | null>(null);
  const rejectRef = useRef<((err: Error) => void) | null>(null);
  const isMountedRef = useRef<boolean>(false);

  const print = useCallback((document: React.ReactNode): Promise<void> => {
    if (isPrinting) {
      console.warn('[PdfPrintManager] Une impression est déjà en cours');
      return Promise.reject(new Error('Impression déjà en cours'));
    }

    return new Promise<void>((resolve, reject) => {
      resolveRef.current = resolve;
      rejectRef.current = reject;
      setIsPrinting(true);
      setActiveDocument(document);
    });
  }, [isPrinting]);

  useEffect(() => {
    if (!activeDocument) return;

    isMountedRef.current = true;

    const executePrint = async () => {
      try {
        // 1. Attendre React render
        await new Promise((r) => requestAnimationFrame(r));
        await new Promise((r) => requestAnimationFrame(r));

        // 2. Attendre browser layout
        await new Promise((r) => setTimeout(r, 50));

        // 3. Attendre fonts si disponibles
        if ('fonts' in document && document.fonts?.ready) {
          try {
            await document.fonts.ready;
          } catch {
            // Ignore font errors
          }
        }

        // 4. Exécuter print
        if (!isMountedRef.current) return;
        window.print();
      } catch (err) {
        console.error('[PdfPrintManager] Erreur lors de l\'impression:', err);
        if (rejectRef.current) {
          rejectRef.current(err instanceof Error ? err : new Error(String(err)));
        }
        cleanup();
      }
    };

    const cleanup = () => {
      isMountedRef.current = false;
      setActiveDocument(null);
      setIsPrinting(false);
      resolveRef.current = null;
      rejectRef.current = null;
    };

    const handleAfterPrint = () => {
      if (resolveRef.current) resolveRef.current();
      cleanup();
    };

    executePrint();

    window.addEventListener('afterprint', handleAfterPrint, { once: true });

    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
      if (isMountedRef.current) {
        cleanup();
      }
    };
  }, [activeDocument]);

  return (
    <PdfContext.Provider value={{ print, isPrinting }}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <div id="foodops-pdf-portal" aria-hidden={!isPrinting}>
            {activeDocument}
          </div>,
          document.body
        )}
    </PdfContext.Provider>
  );
}

export const usePdfPrint = () => useContext(PdfContext);