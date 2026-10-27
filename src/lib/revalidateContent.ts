import 'server-only';
import { revalidatePath, revalidateTag } from 'next/cache';

const IMMEDIATE = { expire: 0 };

function unique(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

export function revalidateJobSurfaces(jobIds: Array<string | null | undefined> = []) {
  revalidateTag('job-offers', IMMEDIATE);
  revalidatePath('/cz7tk');
  revalidatePath('/cz7tk/jobs');
  revalidatePath('/');
  revalidatePath('/jobs');
  revalidatePath('/stages');
  revalidatePath('/jobs/today');
  revalidatePath('/bourses');
  revalidatePath('/[landing]', 'page');

  for (const id of unique(jobIds)) {
    revalidatePath(`/cz7tk/jobs/${id}`);
    revalidatePath(`/jobs/${id}`);
  }
}

export function revalidateExamSurfaces(exam?: { id: string; slug?: string | null }) {
  revalidateTag('exams', IMMEDIATE);
  revalidatePath('/');
  revalidatePath('/cz7tk/exams');
  revalidatePath('/concours');

  if (exam) {
    revalidatePath(`/concours/${exam.slug || exam.id}`);
  }
}

export function revalidateBlogSurfaces(slugs: Array<string | null | undefined> = []) {
  revalidateTag('blog', IMMEDIATE);
  revalidatePath('/blog');
  revalidatePath('/cz7tk/blog');

  for (const slug of unique(slugs)) {
    revalidatePath(`/blog/${slug}`);
  }
}

export function revalidateArticleSurfaces(slugs: Array<string | null | undefined> = []) {
  revalidateTag('articles', IMMEDIATE);
  revalidatePath('/actualites');
  revalidatePath('/cz7tk/actualites');

  for (const slug of unique(slugs)) {
    revalidatePath(`/actualites/${slug}`);
  }
}

export function revalidateEntreprendreSurfaces(slugs: Array<string | null | undefined> = []) {
  revalidateTag('entreprendre', IMMEDIATE);
  revalidatePath('/entreprendre');
  revalidatePath('/cz7tk/entreprendre');

  for (const slug of unique(slugs)) {
    revalidatePath(`/entreprendre/${slug}`);
  }
}
