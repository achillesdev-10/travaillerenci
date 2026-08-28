'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';
import { slugify } from '@/lib/slugify';

interface ParsedArticle {
  title: string;
  slug: string;
  category: string;
  excerpt: string;
  content: string;
  image_url: string;
  author: string;
  tags: string;
  status: 'draft' | 'published';
  selected: boolean;
}

type ImportStatus = 'idle' | 'parsing' | 'preview' | 'importing' | 'done' | 'error';

const CSV_HEADERS = 'title,category,budget_range,estimated_budget_amount,excerpt,content,image_url';

function downloadTemplate() {
  const example = `${CSV_HEADERS}\nComment ouvrir un salon de coiffure à Abidjan,"Coiffure & Beauté",moyen,2000000,"Guide complet pour lancer votre salon de coiffure à Abidjan.","## Étape 1 : Étude de marché\\n\\nAnalysez la concurrence dans votre quartier.\\n\\n## Étape 2 : Localisation\\n\\nChoisissez un emplacement à forte fréquentation.",https://example.com/image.jpg`;
  const blob = new Blob([example], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'modele-articles-blog.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function BulkImportClient() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [articles, setArticles] = useState<ParsedArticle[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<{ imported: number; errors?: Array<{ index: number; error: string }> } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleFile = useCallback((file: File) => {
    setStatus('parsing');
    setErrorMsg('');
    setResult(null);

    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'json') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const raw = JSON.parse(e.target?.result as string);
          const items = Array.isArray(raw) ? raw : raw.articles || [];
          processItems(items);
        } catch {
          setErrorMsg('Fichier JSON invalide.');
          setStatus('error');
        }
      };
      reader.readAsText(file);
    } else {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          processItems(results.data as Record<string, string>[]);
        },
        error: () => {
          setErrorMsg('Erreur lors de la lecture du fichier CSV.');
          setStatus('error');
        },
      });
    }
  }, []);

  function processItems(items: Record<string, string>[]) {
    const parsed: ParsedArticle[] = items
      .map((item) => {
        const title = (item.title || '').trim();
        const content = (item.content || '').trim();
        if (!title || !content) return null;
        return {
          title,
          slug: slugify(title),
          category: (item.category || '').trim(),
          excerpt: (item.excerpt || '').trim(),
          content,
          image_url: (item.image_url || '').trim(),
          author: 'TravaillerenCi',
          tags: (item.category || '').trim(),
          status: 'draft' as const,
          selected: true,
        };
      })
      .filter(Boolean) as ParsedArticle[];

    if (parsed.length === 0) {
      setErrorMsg('Aucun article valide trouvé. Vérifiez que chaque ligne a un titre et un contenu.');
      setStatus('error');
      return;
    }

    setArticles(parsed);
    setStatus('preview');
  }

  function toggleArticle(index: number) {
    setArticles((prev) =>
      prev.map((a, i) => (i === index ? { ...a, selected: !a.selected } : a))
    );
  }

  function toggleAll() {
    const allSelected = articles.every((a) => a.selected);
    setArticles((prev) => prev.map((a) => ({ ...a, selected: !allSelected })));
  }

  function removeArticle(index: number) {
    setArticles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleImport() {
    const selected = articles.filter((a) => a.selected);
    if (selected.length === 0) return;

    setStatus('importing');
    setProgress({ current: 0, total: selected.length });
    setResult(null);

    try {
      const res = await fetch('/api/cz7tk/blog/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articles: selected.map((a) => ({
            title: a.title,
            slug: a.slug,
            excerpt: a.excerpt || null,
            content: a.content,
            cover_image: a.image_url || null,
            author: a.author,
            tags: a.tags || null,
            status: a.status,
          })),
        }),
      });

      if (res.status === 401) {
        router.replace('/cz7tk/login?next=/cz7tk/blog/bulk-import');
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Erreur lors de l\'importation.');
        setStatus('error');
        return;
      }

      setProgress({ current: selected.length, total: selected.length });
      setResult({ imported: data.imported || 0, errors: data.errors });
      setStatus('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur lors de l\'importation.');
      setStatus('error');
    }
  }

  function handleReset() {
    setStatus('idle');
    setArticles([]);
    setResult(null);
    setErrorMsg('');
    setProgress({ current: 0, total: 0 });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="space-y-8 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <button
              type="button"
              onClick={() => router.push('/cz7tk/blog')}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5" />
                <path d="m12 19-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white font-[var(--font-display)]">
              Importation en masse
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Importez plusieurs articles de blog depuis un fichier CSV ou JSON.
          </p>
        </div>
        <button
          type="button"
          onClick={downloadTemplate}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs font-bold text-slate-300 hover:bg-slate-800 transition-all"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <path d="M7 10l5 5 5-5" />
            <path d="M12 15V3" />
          </svg>
          Télécharger le modèle CSV
        </button>
      </div>

      {/* Upload zone */}
      {(status === 'idle' || status === 'error') && (
        <div
          className="rounded-3xl border-2 border-dashed border-slate-700 bg-slate-950 p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <path d="M17 8l-5-5-5 5" />
                <path d="M12 3v12" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-white">
                Glissez-déposez un fichier ici
              </p>
              <p className="text-xs text-slate-500 mt-1">
                ou cliquez pour sélectionner un fichier CSV ou JSON
              </p>
            </div>
            <p className="text-[10px] text-slate-600">
              Formats acceptés : .csv, .json — Max 200 articles
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>
      )}

      {/* Error */}
      {status === 'error' && errorMsg && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {errorMsg}
        </div>
      )}

      {/* Parsing */}
      {status === 'parsing' && (
        <div className="rounded-3xl border border-slate-800 bg-slate-950 p-8 text-center">
          <div className="inline-flex items-center gap-3 text-sm text-slate-300">
            <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Analyse du fichier en cours…
          </div>
        </div>
      )}

      {/* Preview table */}
      {status === 'preview' && articles.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-300">
              <span className="font-bold text-white">{articles.filter((a) => a.selected).length}</span> article{articles.filter((a) => a.selected).length > 1 ? 's' : ''} sélectionné{articles.filter((a) => a.selected).length > 1 ? 's' : ''} sur {articles.length}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={toggleAll}
                className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold"
              >
                {articles.every((a) => a.selected) ? 'Tout désélectionner' : 'Tout sélectionner'}
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={articles.filter((a) => a.selected).length === 0}
                className="px-4 py-1.5 rounded-xl bg-primary text-slate-950 text-xs font-bold hover:brightness-110 transition-all disabled:opacity-50"
              >
                Importer la sélection
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-950 overflow-hidden shadow-xl">
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-slate-800 bg-slate-900 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={articles.every((a) => a.selected)}
                        onChange={toggleAll}
                        className="h-4 w-4 rounded border-white/20 bg-slate-900 text-primary"
                      />
                    </th>
                    <th className="py-3 px-4">Titre</th>
                    <th className="py-3 px-4">Slug</th>
                    <th className="py-3 px-4">Catégorie</th>
                    <th className="py-3 px-4">Contenu</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {articles.map((article, i) => (
                    <tr key={i} className={`transition-colors ${article.selected ? 'bg-slate-900/40' : 'opacity-50'}`}>
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={article.selected}
                          onChange={() => toggleArticle(i)}
                          className="h-4 w-4 rounded border-white/20 bg-slate-900 text-primary"
                        />
                      </td>
                      <td className="py-3 px-4 font-bold text-white max-w-[200px] truncate">
                        {article.title}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400 max-w-[150px] truncate">
                        /blog/{article.slug}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                          {article.category || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400 max-w-[200px] truncate">
                        {article.content.substring(0, 80)}…
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => removeArticle(i)}
                          className="px-2 py-1 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs font-semibold"
                        >
                          Retirer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Importing progress */}
      {status === 'importing' && (
        <div className="rounded-3xl border border-slate-800 bg-slate-950 p-8 text-center space-y-4">
          <div className="inline-flex items-center gap-3 text-sm text-slate-300">
            <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Importation en cours…
          </div>
          <div className="w-full bg-slate-900 rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
            />
          </div>
          <p className="text-xs text-slate-500">
            {progress.current} / {progress.total} articles traités
          </p>
        </div>
      )}

      {/* Done */}
      {status === 'done' && result && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <path d="m9 11 3 3L22 4" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-300">
                  {result.imported} article{result.imported > 1 ? 's' : ''} importé{result.imported > 1 ? 's' : ''} avec succès !
                </p>
                {result.errors && result.errors.length > 0 && (
                  <p className="text-xs text-amber-400 mt-1">
                    {result.errors.length} erreur{result.errors.length > 1 ? 's' : ''} — {result.errors.map((e) => `Ligne ${e.index}: ${e.error}`).join(', ')}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2.5 rounded-2xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold"
            >
              Importer d&apos;autres articles
            </button>
            <button
              type="button"
              onClick={() => router.push('/cz7tk/blog')}
              className="px-4 py-2.5 rounded-2xl bg-primary text-slate-950 text-xs font-bold hover:brightness-110 transition-all"
            >
              Retour au blog
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
