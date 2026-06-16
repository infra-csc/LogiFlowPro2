import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export interface ObjectUploaderResult {
  successful: Array<{ response?: { body?: { url?: string } } }>;
}

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  onComplete?: (result: ObjectUploaderResult) => void;
  buttonClassName?: string;
  buttonVariant?: "default" | "outline" | "secondary" | "ghost" | "destructive";
  children: ReactNode;
  accept?: string;
}

/**
 * Simple file upload component — uses a hidden <input type="file"> to avoid
 * portal / focus-trap conflicts with Radix UI dialogs. Uploads via XHR to
 * /api/objects/upload and calls onComplete with a result shaped like Uppy's.
 */
export function ObjectUploader({
  maxFileSize = 10485760,
  onComplete,
  buttonClassName,
  buttonVariant = "outline",
  children,
  accept = "image/png,image/jpeg,image/webp",
}: ObjectUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > maxFileSize) {
      toast({
        description: `Arquivo muito grande. Máximo: ${Math.round(maxFileSize / 1024 / 1024)} MB.`,
        variant: "destructive",
      });
      e.target.value = "";
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/objects/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Upload falhou: ${response.statusText}`);
      }

      const body = await response.json();

      onComplete?.({
        successful: [{ response: { body: { url: body.url } } }],
      });
    } catch (err) {
      toast({
        description: "Erro ao enviar arquivo. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleFileChange}
        data-testid="input-file-upload"
      />
      <Button
        onClick={() => inputRef.current?.click()}
        className={buttonClassName}
        variant={buttonVariant}
        type="button"
        disabled={uploading}
        data-testid="button-upload-file"
      >
        {uploading ? "Enviando..." : children}
      </Button>
    </>
  );
}
