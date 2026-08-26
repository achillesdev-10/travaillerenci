import { NextResponse } from 'next/server';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

// -----------------------------------------------------------------------------
// Sondage de la page d'accueil — persistance SQLite (repli en mémoire si le
// module node:sqlite est indisponible, ex. build/SSG sans Node 22).
// -----------------------------------------------------------------------------

const POLL = {
  question: 'Quel type d\u2019opportunit\u00e9 vous int\u00e9resse le plus ?',
  options: [
    "Offres d'emploi (CDI / CDD)",
    'Concours administratifs',
    'Stages',
    "Bourses d'\u00e9tudes",
    'Alternance / Freelance',
  ],
};

// Votes fictifs initiaux pour simuler de l'activité
const MEMORY_VOTES = [127, 94, 83, 71, 45];

type DatabaseSyncInstance = {
  exec(sql: string): void;
  prepare(sql: string): {
    run(params?: unknown): { changes: number };
    all(params?: unknown): any[];
  };
};

let cachedDb: DatabaseSyncInstance | null | undefined;

async function getDb(): Promise<DatabaseSyncInstance | null> {
  if (cachedDb !== undefined) return cachedDb;
  try {
    const mod = (await import('node:sqlite')) as unknown as {
      DatabaseSync: new (path: string) => DatabaseSyncInstance;
    };
    const { resolve } = (await import('node:path')) as typeof import('node:path');
    const db = new mod.DatabaseSync(resolve(process.cwd(), 'data/travaillerenci.sqlite3'));
    db.exec(`
      CREATE TABLE IF NOT EXISTS poll_votes (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        option_index INTEGER NOT NULL,
        visitor_id  TEXT,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_poll_visitor ON poll_votes (visitor_id);
    `);
    cachedDb = db;
    // Seed fictitious votes if the table is empty
    const existing = db.prepare('SELECT COUNT(*) AS c FROM poll_votes').all();
    const totalVotes = existing.length > 0 ? Number((existing[0] as any).c) : 0;
    if (totalVotes === 0) {
      const seedVotes = [127, 94, 83, 71, 45];
      const stmt = db.prepare('INSERT INTO poll_votes (option_index, visitor_id) VALUES ($o, $v)');
      for (let o = 0; o < seedVotes.length; o++) {
        for (let i = 0; i < seedVotes[o]; i++) {
          stmt.run({ $o: o, $v: `seed-${o}-${i}` });
        }
      }
    }
    return db;
  } catch {
    cachedDb = null;
    return null;
  }
}

async function readVotes(): Promise<number[]> {
  const db = await getDb();
  if (!db) return [...MEMORY_VOTES];
  const rows = db
    .prepare('SELECT option_index, COUNT(*) AS c FROM poll_votes GROUP BY option_index')
    .all();
  const votes = new Array<number>(POLL.options.length).fill(0);
  for (const row of rows) {
    const idx = Number(row.option_index);
    if (Number.isInteger(idx) && idx >= 0 && idx < votes.length) {
      votes[idx] = Number(row.c);
    }
  }
  return votes;
}

function clientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'anon'
  );
}

export async function GET(req: Request) {
  void req;
  const votes = await readVotes();
  return NextResponse.json({ ...POLL, votes });
}

export async function POST(req: Request) {
  let body: { option?: unknown; visitor?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  const option = Number(body.option);
  if (!Number.isInteger(option) || option < 0 || option >= POLL.options.length) {
    return NextResponse.json({ error: 'Option invalide' }, { status: 400 });
  }

  const visitor = typeof body.visitor === 'string' && body.visitor.trim()
    ? body.visitor.trim().slice(0, 64)
    : `ip-${clientIp(req)}`;

  const db = await getDb();
  if (db) {
    db.prepare('DELETE FROM poll_votes WHERE visitor_id = $v').run({ $v: visitor });
    db.prepare('INSERT INTO poll_votes (option_index, visitor_id) VALUES ($o, $v)').run({
      $o: option,
      $v: visitor,
    });
  } else {
    MEMORY_VOTES[option] += 1;
  }

  const votes = await readVotes();
  return NextResponse.json({ ok: true, ...POLL, votes });
}
