import { useApp } from "../state/AppContext";

interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 64, className = "" }: LogoProps) {
  const { db } = useApp();
  const logo = db.company?.logo;

  if (!logo) {
    return (
      <div className={`bg-gradient-to-br from-blue-600 to-blue-800 text-white font-bold flex items-center justify-center rounded-lg shadow-sm border border-blue-700 ${className}`} style={{ width: size, height: size, fontSize: size * 0.35 }}>
        FO
      </div>
    );
  }

  return (
    <img src={logo} alt="Logo" className={`rounded-lg object-contain bg-white shadow-sm border border-line ${className}`} style={{ width: size, height: size }} />
  );
}
