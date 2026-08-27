/**
 *  TravaillerEnCi — Service d'alertes administrateur
 *  Chemin : src/services/adminAlerts.ts
 *
 *  Envoie une notification WhatsApp (ou log) à chaque tentative de connexion
 *  échouée sur le panneau admin.
 *
 *  Canal : WhatsApp Cloud API (même infrastructure que whatsappNotify.ts).
 *
 *  ⚠️ INACTIF PAR DÉFAUT — nécessite :
 *    - ADMIN_ALERT_ENABLED = "1"
 *    - WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID + WHATSAPP_TARGET_PHONE
 *
 *  Variables dédiées (optionnel, pour séparer les alertes admin des notifications
 *  concours) :
 *    - ADMIN_ALERT_WEBHOOK_URL : webhook externe (n8n, Make…) en priorité
 *    - Sinon, fallback sur WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID +
 *      WHATSAPP_TARGET_PHONE (même canal que les notifications concours)
 */
import 'server-only';

const WHATSAPP_API_VERSION = 'v21.0';

interface LoginFailedEvent {
  ip: string;
  email: string;
}

function isEnabled(): boolean {
  if (process.env.ADMIN_ALERT_ENABLED !== '1') return false;

  // Webhook externe prioritaire
  if (process.env.ADMIN_ALERT_WEBHOOK_URL) return true;

  // Sinon, fallback WhatsApp direct
  return Boolean(
    process.env.WHATSAPP_TOKEN &&
      process.env.WHATSAPP_PHONE_NUMBER_ID &&
      process.env.WHATSAPP_TARGET_PHONE,
  );
}

function buildMessage(event: LoginFailedEvent): string {
  const now = new Date().toLocaleString('fr-FR', {
    timeZone: 'Africa/Abidjan',
  });
  const lines = [
    `🚨 *ALERTE SÉCURITÉ — Tentative de connexion admin échouée*`,
    ``,
    `🕐 Date/heure : ${now}`,
    `🌐 IP : ${event.ip}`,
    `📧 Email tenté : ${event.email}`,
  ];
  return lines.join('\n');
}

/**
 * Notifie une tentative de connexion admin échouée.
 * Ne lève JAMAIS : échec → log console uniquement.
 */
export async function notifyAdminLoginFailed(
  event: LoginFailedEvent,
): Promise<void> {
  if (!isEnabled()) {
    console.log(
      '[adminAlerts] alertes désactivées (ADMIN_ALERT_ENABLED absent).',
    );
    return;
  }

  try {
    const message = buildMessage(event);

    // --- Canal 1 : Webhook externe (n8n, Make, Zapier…) ---
    const webhookUrl = process.env.ADMIN_ALERT_WEBHOOK_URL;
    if (webhookUrl) {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'admin_login_failed',
          ip: event.ip,
          email: event.email,
          timestamp: new Date().toISOString(),
          message,
        }),
      });
      if (!res.ok) {
        console.error(
          `[adminAlerts] webhook échec (${res.status}): ${await res.text().catch(() => '').then((t) => t.slice(0, 200))}`,
        );
      } else {
        console.log(`[adminAlerts] webhook envoyé pour IP ${event.ip}`);
      }
      return;
    }

    // --- Canal 2 : WhatsApp Cloud API direct ---
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const token = process.env.WHATSAPP_TOKEN;
    const target = process.env.WHATSAPP_TARGET_PHONE;

    if (!phoneNumberId || !token || !target) return;

    const res = await fetch(
      `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: target,
          type: 'text',
          text: { body: message },
        }),
      },
    );

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(
        `[adminAlerts] WhatsApp API échec (${res.status}): ${detail.slice(0, 300)}`,
      );
    } else {
      console.log(`[adminAlerts] alerte envoyée pour IP ${event.ip}`);
    }
  } catch (err) {
    console.error('[adminAlerts] erreur:', err);
  }
}
