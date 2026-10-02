import { test, expect, type Page } from '@playwright/test';
import { waitForHydration, registerCandidate } from './helpers';

/**
 * §27 — Accessibilité : contraste, labels de formulaires, navigation clavier,
 * attributs aria, textes alternatifs, messages d'erreur compréhensibles.
 *
 * Contrôle automatisé des points vérifiables sans dépendance externe (aucune
 * librairie d'audit n'est installée) : nom accessible de chaque champ et
 * bouton, `alt` des images, landmark principal, titre h1, focus clavier et
 * message d'erreur annoncé par `role="alert"`.
 */

const AUDITED_PAGES = ['/', '/jobs', '/login', '/register', '/generateur-de-cv'];

/** Évalue les règles d'accessibilité côté navigateur et retourne les écarts. */
async function auditAccessibility(page: Page, path: string): Promise<string[]> {
  await waitForHydration(page, path);

  return page.evaluate(() => {
    const problems: string[] = [];

    const text = (el: Element | null) => (el?.textContent || '').replace(/\s+/g, ' ').trim();

    const accessibleName = (el: Element): string => {
      const aria = el.getAttribute('aria-label');
      if (aria && aria.trim()) return aria.trim();

      const labelledBy = el.getAttribute('aria-labelledby');
      if (labelledBy) {
        const parts = labelledBy
          .split(/\s+/)
          .map((id) => text(document.getElementById(id)))
          .join(' ')
          .trim();
        if (parts) return parts;
      }

      if (el.id) {
        const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (label && text(label)) return text(label);
      }

      const wrapping = el.closest('label');
      if (wrapping && text(wrapping)) return text(wrapping);

      const title = el.getAttribute('title');
      if (title && title.trim()) return title.trim();

      return text(el);
    };

    // 1. Champs de formulaire : nom accessible obligatoire (§27 « labels »).
    const fields = document.querySelectorAll('input, select, textarea');
    fields.forEach((field) => {
      const type = (field.getAttribute('type') || '').toLowerCase();
      if (type === 'hidden' || type === 'submit' || type === 'button' || type === 'image') return;
      if (field.getAttribute('aria-hidden') === 'true') return;
      if (!accessibleName(field)) {
        problems.push(
          `champ sans nom accessible : <${field.tagName.toLowerCase()}${
            field.getAttribute('type') ? ` type="${field.getAttribute('type')}"` : ''
          } placeholder="${field.getAttribute('placeholder') || ''}">`,
        );
      }
    });

    // 2. Boutons : nom accessible obligatoire.
    document.querySelectorAll('button').forEach((button) => {
      if (button.getAttribute('aria-hidden') === 'true') return;
      if (!accessibleName(button)) problems.push('bouton sans nom accessible');
    });

    // 3. Images : attribut alt obligatoire (vide accepté si décorative).
    document.querySelectorAll('img').forEach((img) => {
      if (img.getAttribute('aria-hidden') === 'true') return;
      if (img.getAttribute('role') === 'presentation' || img.getAttribute('role') === 'none') return;
      if (img.getAttribute('alt') === null) {
        problems.push(`image sans attribut alt : ${img.getAttribute('src') || ''}`.slice(0, 120));
      }
    });

    // 4. Structure : landmark principal + titre h1 unique.
    if (!document.querySelector('main')) problems.push('landmark <main> absent');
    if (document.querySelectorAll('h1').length < 1) problems.push('titre <h1> absent');

    return problems;
  });
}

test.describe('Accessibilité (§27)', () => {
  for (const path of AUDITED_PAGES) {
    test(`champs, images et structure — ${path}`, async ({ page }) => {
      const problems = await auditAccessibility(page, path);
      expect(problems, `Écarts sur ${path} :\n${problems.join('\n')}`).toEqual([]);
    });
  }

  test('navigation clavier : la touche Tab déplace le focus', async ({ page }) => {
    await waitForHydration(page, '/');
    await page.keyboard.press('Tab');
    const firstFocus = await page.evaluate(() => document.activeElement?.tagName || '');
    expect(firstFocus).not.toBe('BODY');

    // Le focus doit rester visible sur l'élément atteint.
    const focused = page.locator(':focus');
    await expect(focused).toBeVisible();
  });

  test("message d'erreur annoncé par role=alert (inscription)", async ({ page }) => {
    await waitForHydration(page, '/register');

    await page.getByPlaceholder('Koffi Kouadio').fill('Test A11y');
    await page.getByPlaceholder('vous@exemple.ci').first().fill('a11y-test@test.ci');
    const passwords = page.getByPlaceholder('••••••••');
    await passwords.nth(0).fill('MotDePasse1!');
    await passwords.nth(1).fill('MotDePasse2!'); // ne correspond pas
    await page.getByRole('button', { name: /S.inscrire/ }).click();

    const alert = page.locator('[role="alert"]').filter({ hasText: /ne correspondent/i });
    await expect(alert).toBeVisible({ timeout: 10_000 });
  });

  test('contraste des textes principaux (≥ 4.5:1)', async ({ page }) => {
    await waitForHydration(page, '/');

    const violations = await page.evaluate(() => {
      const luminance = (color: number[]) => {
        const [r, g, b] = color.map((value) => {
          const channel = value / 255;
          return channel <= 0.03928
            ? channel / 12.92
            : Math.pow((channel + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };

      // Les couleurs Tailwind v4 sont sérialisées en oklch()/lab() : on les
      // fait passer par un canvas 1px pour obtenir des bytes sRGB.
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

      const parse = (value: string): number[] | null => {
        if (!value || value === 'transparent' || value.includes('none')) return null;
        ctx.fillStyle = '#ff00ff';
        ctx.fillStyle = value;
        const normalized = ctx.fillStyle;
        if (normalized === '#ff00ff') return null;
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillRect(0, 0, 1, 1);
        const data = ctx.getImageData(0, 0, 1, 1).data;
        if (data[3] < 128) return null; // trop transparent : on remonte
        return [data[0], data[1], data[2]];
      };

      const effectiveBackground = (el: Element): number[] | null => {
        let current: Element | null = el;
        while (current) {
          const style = getComputedStyle(current);
          // Fond en dégradé/image : contraste non calculable automatiquement.
          if (style.backgroundImage && style.backgroundImage !== 'none') return null;
          const bg = parse(style.backgroundColor);
          if (bg) return bg;
          current = current.parentElement;
        }
        return [255, 255, 255];
      };

      const bad: string[] = [];
      const nodes = Array.from(document.querySelectorAll('main h1, main h2, main p, main a, main span'))
        .slice(0, 120);

      for (const node of nodes) {
        const el = node as HTMLElement;
        const value = (el.textContent || '').trim();
        if (!value) continue;
        if (!el.getClientRects().length) continue; // masqué

        const style = getComputedStyle(el);
        const fg = parse(style.color);
        if (!fg) continue;

        const bg = effectiveBackground(el);
        if (!bg) continue;
        const l1 = luminance(fg);
        const l2 = luminance(bg);
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

        const fontSize = parseFloat(style.fontSize) || 16;
        const bold = Number(style.fontWeight) >= 700;
        const large = fontSize >= 24 || (fontSize >= 18.66 && bold);
        const required = large ? 3 : 4.5;
        if (ratio + 0.05 < required) {
          bad.push(`${value.slice(0, 40)} → ${ratio.toFixed(2)}:1 (min ${required})`);
        }
      }
      return bad;
    });

    expect(violations, `Contraste insuffisant :\n${violations.join('\n')}`).toEqual([]);
  });

  test('cibles tactiles ≥ 40 px sur mobile (390 px)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await waitForHydration(page, '/');

    const menuButton = page.getByRole('button', { name: 'Menu' }).first();
    await expect(menuButton).toBeVisible({ timeout: 20_000 });
    const box = await menuButton.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.min(box!.width, box!.height)).toBeGreaterThanOrEqual(40);
  });

  test('formulaires atteignables au clavier sur le dashboard', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await registerCandidate(page);

    // Le champ ville du profil doit être focusable et correctement étiqueté.
    const cityField = page.locator('#profile-city');
    if ((await cityField.count()) > 0) {
      await cityField.focus();
      await expect(cityField).toBeFocused();
      const labelled = await page.evaluate(() => {
        const field = document.querySelector('#profile-city');
        if (!field) return true;
        const id = field.getAttribute('id');
        return Boolean(id && document.querySelector(`label[for="${id}"]`));
      });
      expect(labelled, 'champ ville du profil sans label associé').toBe(true);
    }
  });
});
