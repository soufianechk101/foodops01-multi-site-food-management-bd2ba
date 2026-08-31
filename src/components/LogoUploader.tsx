import { useState, useRef } from "react";
import { Upload, X } from "lucide-react";
import { useApp } from "../state/AppContext";
import { Button } from "./ui";

export function LogoUploader() {
  const { db, act } = useApp();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Veuillez sélectionner une image valide (PNG, JPG).");
      return;
    }

    setIsUploading(true);
    try {
      const resizedBase64 = await resizeImage(file, 200);
      act(
        (d) => { d.company.logo = resizedBase64; },
        "Logo de l'entreprise mis à jour avec succès."
      );
    } catch (err) {
      console.error("Erreur image", err);
      alert("Erreur lors du traitement de l'image.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeLogo = () => {
    act((d) => { delete d.company.logo; }, "Logo supprimé.");
  };

  const resizeImage = (file: File, maxSize: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxSize) { height = (height * maxSize) / width; width = maxSize; }
          } else {
            if (height > maxSize) { width = (width * maxSize) / height; height = maxSize; }
          }
          canvas.width = width;
          canvas.height = height;
          canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/png", 0.85));
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="flex flex-col items-start gap-4 p-4 border border-line rounded-lg bg-paper mb-6">
      <div className="flex items-start gap-4 w-full">
        <div className="relative shrink-0">
          {db.company.logo ? (
            <img src={db.company.logo} alt="Preview" className="w-24 h-24 object-contain rounded-lg border border-line bg-white p-1" />
          ) : (
            <div className="w-24 h-24 flex flex-col items-center justify-center rounded-lg border border-dashed border-line bg-white text-mute text-xs gap-1">
              <Upload size={20} />
              <span>Aucun logo</span>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 flex-1">
          <h3 className="font-semibold text-ink text-sm">Logo de l'entreprise</h3>
          <p className="text-xs text-mute">Format recommandé : PNG ou JPG. Redimensionnement automatique.</p>
          <div className="flex gap-2 mt-1">
            <input type="file" ref={fileInputRef} accept="image/png, image/jpeg" onChange={handleFileChange} className="hidden" disabled={isUploading} />
            <Button variant="outline" size="sm" icon={<Upload size={14} />} onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
              {isUploading ? "Traitement..." : "Téléverser un logo"}
            </Button>
            {db.company.logo && (
              <Button variant="ghost" size="sm" icon={<X size={14} />} onClick={removeLogo} className="text-bad hover:text-bad hover:bg-bad/10">
                Supprimer
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}