'use client';

import { useCallback, useRef, useState } from 'react';

interface AvatarUploadProps {
  /** URL actuelle de la photo de profil (null = pas de photo). */
  avatarUrl: string | null;
  /** Prénom (initiale affichée en fallback). */
  name: string;
  /** Callback quand la photo change (URL ou null). */
  onChange: (url: string | null) => void;
  /** Taille en pixels (défaut 96). */
  size?: number;
}

/**
 * Composant d'upload de photo de profil avec aperçu en direct.
 * - Clic sur l'avatar → sélecteur de fichier
 * - Drag & drop sur l'avatar
 * - Suppression possible si une photo est présente
 */
export default function AvatarUpload({
  avatarUrl,
  name,
  onChange,
  size = 96,
}: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const initial = (name?.[0] || '?').toUpperCase();

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      // Validation côté client
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        setError('Format non supporté (JPG, PNG ou WebP).');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('Image trop lourde (5 Mo maximum).');
        return;
      }

      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/user/avatar', {
          method: 'POST',
          body: formData,
        });

        if (res.status === 501) {
          // Supabase non configuré — on utilise un aperçu local
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
          onChange(dataUrl);
          setError('Stockage cloud non configuré — photo en aperçu local uniquement.');
          return;
        }

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setError(data?.error || 'Erreur lors de l\'upload.');
          return;
        }

        const data = await res.json();
        onChange(data.avatar_url);
      } catch {
        setError('Serveur injoignable. Réessayez.');
      } finally {
        setUploading(false);
      }
    },
    [onChange],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // Reset l'input pour permettre de re-sélectionner le même fichier
      if (inputRef.current) inputRef.current.value = '';
    },
    [handleFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDelete = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      setError(null);
      setUploading(true);
      try {
        const res = await fetch('/api/user/avatar', { method: 'DELETE' });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setError(data?.error || 'Erreur lors de la suppression.');
          return;
        }
        onChange(null);
      } catch {
        setError('Serveur injoignable.');
      } finally {
        setUploading(false);
      }
    },
    [onChange],
  );

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Zone cliquable / droppable */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        disabled={uploading}
        className="relative group rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50"
        style={{ width: size, height: size }}
        aria-label="Changer la photo de profil"
      >
        {/* Image ou initiale */}
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={`Photo de ${name}`}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full rounded-full bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center text-white font-black shadow-lg shadow-primary/20"
            style={{ fontSize: size * 0.38 }}
          >
            {initial}
          </div>
        )}

        {/* Overlay au survol */}
        <div
          className={`absolute inset-0 rounded-full flex items-center justify-center transition-opacity duration-200 ${
            dragOver
              ? 'bg-black/40 opacity-100'
              : 'bg-black/30 opacity-0 group-hover:opacity-100'
          }`}
        >
          {uploading ? (
            <svg
              className="animate-spin w-6 h-6 text-white"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          ) : (
            <svg
              className="w-6 h-6 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          )}
        </div>

        {/* Indicateur drag-over */}
        {dragOver && (
          <div className="absolute inset-0 rounded-full border-2 border-dashed border-white" />
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleInputChange}
      />

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="text-[11px] font-semibold text-primary hover:underline disabled:opacity-50"
        >
          {avatarUrl ? 'Changer' : 'Ajouter une photo'}
        </button>
        {avatarUrl && (
          <>
            <span className="text-gray-300 dark:text-slate-600">·</span>
            <button
              type="button"
              onClick={handleDelete}
              disabled={uploading}
              className="text-[11px] font-semibold text-rose-500 hover:underline disabled:opacity-50"
            >
              Supprimer
            </button>
          </>
        )}
      </div>

      {/* Erreur */}
      {error && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400 text-center max-w-[200px]">
          {error}
        </p>
      )}
    </div>
  );
}
