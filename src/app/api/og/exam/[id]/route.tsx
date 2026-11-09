/**
 *  TravaillerEnCi — Image Open Graph dynamique des fiches concours
 *  GET /api/og/exam/[id] → PNG 1200×630 (carte sociale brandée)
 *
 *  Utilisée par generateMetadata (openGraph.images + twitter.images) sur
 *  /concours/[slug]. Générée à la volée avec next/og (satori) — sans dépendance
 *  supplémentaire, en runtime Node (le service exams lit SQLite/Supabase).
 */
import { ImageResponse } from 'next/og';
import { ExamService } from '@/services/examService';
import { EXAM_CATEGORY_LABEL, EXAM_PHASE_LABEL, examPhase } from '@/lib/examConstants';
import { getSiteHostname } from '@/lib/site';
import type { Exam } from '@/types/exam';

export const runtime = 'nodejs';
export const revalidate = 3600;

const WIDTH = 1200;
const HEIGHT = 630;

type FontDef = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 700 | 800;
  style: 'normal';
};

let fontsPromise: Promise<FontDef[]> | null = null;

/** Charge Inter (400/700/800) depuis Google Fonts en TTF — le parseur OpenType
 *  embarqué de satori ne sait PAS lire le WOFF2. UA « ancien » → Google renvoie
 *  du TTF. Repli silencieux : police par défaut embarquée si échec. */
function loadFonts(): Promise<FontDef[]> {
  if (!fontsPromise) {
    fontsPromise = (async () => {
      try {
        const css = await fetch(
          'https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800&display=swap',
          {
            headers: {
              'user-agent':
                'Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1; SV1)',
            },
          },
        ).then((r) => r.text());
        const urls = Array.from(css.matchAll(/url\((https:\/\/[^)]+\.ttf)\)/g), (m) => m[1]);
        const weights: FontDef['weight'][] = [400, 700, 800];
        const fonts: FontDef[] = [];
        for (let i = 0; i < weights.length; i++) {
          const url = urls[i] || urls[0];
          if (!url) break;
          const data = await fetch(url).then((r) => r.arrayBuffer());
          fonts.push({ name: 'Inter', data, weight: weights[i], style: 'normal' });
        }
        return fonts;
      } catch {
        return [];
      }
    })();
  }
  return fontsPromise;
}

const PHASE_COLORS: Record<string, string> = {
  open: '#34d399',
  ongoing: '#fbbf24',
  closed: '#fb7185',
  results: '#38bdf8',
};

function OgCard({ exam, fontFamily }: { exam: Exam | null; fontFamily?: string }) {
  const title = exam?.title || 'Concours officiels en Côte d’Ivoire';
  const shortTitle = title.length > 110 ? `${title.slice(0, 107).trim()}…` : title;
  const organizer = exam?.organizer || '';
  const category = exam ? EXAM_CATEGORY_LABEL[exam.category] || exam.category : 'Concours';
  const phase = exam ? examPhase(exam) : null;
  const phaseLabel = phase ? EXAM_PHASE_LABEL[phase] : null;
  const diplomas = exam?.diplomas?.slice(0, 4) || [];
  const deadline = exam?.registration_end;
  const deadlineLabel = deadline
    ? `Clôture : ${new Date(deadline).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })}`
    : 'Inscriptions & épreuves sur la fiche';

  return (
    <div
      style={{
        width: WIDTH,
        height: HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        padding: 64,
        background: 'linear-gradient(135deg, #431407 0%, #7c2d12 55%, #9a3412 100%)',
        color: '#ffffff',
        ...(fontFamily ? { fontFamily } : {}),
      }}
    >
      {/* Barre supérieure : marque + badges */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 28, fontWeight: 800 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #c2410c, #9a3412)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
            }}
          >
            CI
          </div>
          <span>
            Travailleren<span style={{ color: '#fdba74' }}>Ci</span>
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <span
            style={{
              fontSize: 20,
              fontWeight: 700,
              padding: '10px 18px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.12)',
            }}
          >
            {category}
          </span>
          {phaseLabel && (
            <span
              style={{
                fontSize: 20,
                fontWeight: 700,
                padding: '10px 18px',
                borderRadius: 999,
                color: '#022c22',
                background: PHASE_COLORS[phase || ''] || '#ffffff',
              }}
            >
              {phaseLabel}
            </span>
          )}
        </div>
      </div>

      {/* Titre + organisateur */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.12, maxWidth: 1000 }}>
          {shortTitle}
        </div>
        {organizer && (
          <div style={{ marginTop: 22, fontSize: 28, fontWeight: 700, color: '#6ee7b7' }}>
            {organizer}
          </div>
        )}
        {diplomas.length > 0 && (
          <div style={{ display: 'flex', gap: 10, marginTop: 26 }}>
            {diplomas.map((d) => (
              <span
                key={d}
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  padding: '8px 16px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.14)',
                  color: '#a7f3d0',
                }}
              >
                {d}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Pied de page */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 22,
          fontWeight: 700,
          color: '#a7f3d0',
          borderTop: '2px solid rgba(255,255,255,0.18)',
          paddingTop: 24,
        }}
      >
        <span>{getSiteHostname()}</span>
        <span>{deadlineLabel}</span>
      </div>
    </div>
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const exam = await ExamService.getById(id);
  const fonts = await loadFonts();
  return new ImageResponse(
    <OgCard
      exam={exam && exam.status === 'published' ? exam : null}
      fontFamily={fonts.length > 0 ? 'Inter' : undefined}
    />,
    {
      width: WIDTH,
      height: HEIGHT,
      ...(fonts.length > 0 ? { fonts } : {}),
    },
  );
}
