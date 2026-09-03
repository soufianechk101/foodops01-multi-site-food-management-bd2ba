import React from "react";
import "./PdfStyles.css";

export function PdfLayout({
  children,
  orientation = "portrait",
  className,
}: {
  children: React.ReactNode;
  orientation?: "portrait" | "landscape";
  className?: string;
}) {
  return (
    <div 
      className={`pdf-root ${orientation === "landscape" ? "pdf-landscape" : ""} ${className || ""}`}
    >
      {children}
    </div>
  );
}