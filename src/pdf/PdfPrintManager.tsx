import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './PdfStyles.css';

interface PdfContextType {
  print: (document: React.ReactNode) => Promise<void>;
}

const PdfContext = createContext<PdfContextType>({ print: async () => {} });

export function PdfPrintProvider({ children }: { children: React.ReactNode }) {
  const [activeDocument, setActiveDocument] = useState<React.ReactNode>(null);
  const resolveRef = useRef<(() => void) | null>(null);

  const print = useCallback((document: React.ReactNode): Promise<void> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setActiveDocument(document);
    });
  }, []);

  useEffect(() => {
    if (!activeDocument) return;

    // Wait for React to render the portal and fonts to load
    const timer = setTimeout(() => {
      window.print();
    }, 100); // Small delay ensures layout is calculated

    const handleAfterPrint = () => {
      setActiveDocument(null);
      if (resolveRef.current) resolveRef.current();
      resolveRef.current = null;
    };

    window.addEventListener('afterprint', handleAfterPrint);
    
    // Fallback if user cancels print dialog (some browsers don't fire afterprint)
    const visibilityHandler = () => {
      if (document.visibilityState === 'visible' && activeDocument) {
         // Give it a moment, if still active, assume cancelled or done
         setTimeout(() => {
             if (activeDocument) {
                 setActiveDocument(null);
                 if (resolveRef.current) resolveRef.current();
             }
         }, 1000);
      }
    };
    document.addEventListener('visibilitychange', visibilityHandler);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('afterprint', handleAfterPrint);
      document.removeEventListener('visibilitychange', visibilityHandler);
    };
  }, [activeDocument]);

  return (
    <PdfContext.Provider value={{ print }}>
      {children}
      {createPortal(
        <div id="foodops-pdf-portal">
          {activeDocument}
        </div>,
        document.body
      )}
    </PdfContext.Provider>
  );
}

export const usePdfPrint = () => useContext(PdfContext);