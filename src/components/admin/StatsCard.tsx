export default function StatsCard({
  label,
  value,
  change,
  tone = 'primary',
}: {
  label: string;
  value: string;
  change?: string;
  tone?: 'primary' | 'success' | 'warning';
}) {
  const toneClass =
    tone === 'success'
      ? 'from-brand/15 to-brand/5 text-brand'
      : tone === 'warning'
      ? 'from-amber-500/15 to-amber-500/5 text-amber-700'
      : 'from-primary/15 to-accent/5 text-primary';

  return (
    <div className="hover-lift rounded-3xl border border-white/60 bg-white/85 p-6 shadow-lg shadow-slate-200/60 backdrop-blur">
      <div className={`inline-flex rounded-2xl bg-gradient-to-br px-3 py-2 text-sm font-semibold ${toneClass}`}>
        {label}
      </div>
      <div className="mt-5 text-4xl font-black tracking-tight text-slate-950 font-[var(--font-display)]">
        {value}
      </div>
      {change ? (
        <p className="mt-3 text-sm font-medium text-slate-500">{change}</p>
      ) : (
        <p className="mt-3 text-sm text-slate-400">Mise à jour en temps réel</p>
      )}
    </div>
  );
}
