"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PasswordInput from "@/components/auth/PasswordInput";
import { apiForgotPassword, apiLogin } from "@/lib/authApi";
import { isGoogleAuthVisible } from "@/lib/config";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleOverride, setRoleOverride] = useState<"candidate" | "company">("candidate");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // « Mot de passe oublié » : formulaire de demande de réinitialisation.
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  // Affiche les erreurs d'OAuth Google (redirection ?error=...) en clair.
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("error");
    if (!param) return;
    const messages: Record<string, string> = {
      google_not_configured:
        "La connexion avec Google n'est pas encore activée sur le site. Créez un compte avec votre email.",
      oauth_denied:
        "Connexion Google annulée. Vous pouvez vous connecter avec votre email et mot de passe.",
      oauth_invalid_state: "La demande de connexion Google a expiré. Veuillez réessayer.",
      oauth_invalid_token: "Google n'a pas pu confirmer votre identité. Veuillez réessayer.",
      oauth_user_creation: "Impossible de créer votre compte Google pour le moment.",
      oauth_error: "Une erreur est survenue lors de la connexion Google. Veuillez réessayer.",
      rate_limited: "Trop de tentatives. Réessayez dans quelques minutes.",
    };
    setError(messages[param] ?? "Une erreur est survenue.");
    // Nettoie l'URL pour ne pas réafficher l'erreur après un refresh.
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  function validate(): string | null {
    // À la connexion on ne vérifie que le format de l'email : la longueur du
    // mot de passe est une contrainte d'inscription, pas de connexion.
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(email)) {
      return "Veuillez saisir une adresse email valide.";
    }
    if (!password) {
      return "Veuillez saisir votre mot de passe.";
    }
    return null;
  }

  function redirectToDashboard(role?: "candidate" | "company") {
    // Si on vient d'un dashboard protégé (redirection ?next=...), on y revient.
    if (typeof window !== "undefined") {
      const next = new URLSearchParams(window.location.search).get("next");
      if (next && next.startsWith("/") && !next.startsWith("//")) {
        router.push(next);
        return;
      }
    }
    // Le rôle réel vient de la base (réponse du serveur), pas du bouton
    // présélectionné — c'est la source de vérité.
    const effectiveRole = role ?? roleOverride;
    router.push(effectiveRole === "candidate" ? "/dashboard/candidate" : "/dashboard/company");
  }

  function googleAuthHref(): string {
    // On conserve le ?next= existant (protection anti-open-redirect)
    // pour ramener l'utilisateur vers sa destination initiale.
    let next = "/dashboard/candidate";
    if (typeof window !== "undefined") {
      const param = new URLSearchParams(window.location.search).get("next");
      if (param && param.startsWith("/") && !param.startsWith("//")) {
        next = param;
      }
    }
    return `/api/auth/google?role=${roleOverride}&next=${encodeURIComponent(next)}`;
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const result = await apiLogin({ email, password, role: roleOverride });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      // Succès : la session (cookie httpOnly) a été posée par le serveur.
      // Le rôle réel vient de la base (source de vérité), pas du sélecteur.
      redirectToDashboard(result.data.user.role as "candidate" | "company");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Identifiants incorrects");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(resetEmail)) {
      setError("Veuillez saisir une adresse email valide pour la réinitialisation.");
      return;
    }
    setError(null);
    setResetLoading(true);
    const result = await apiForgotPassword({ email: resetEmail });
    setResetLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setResetSent(true);
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col items-center justify-center px-4 py-12 text-gray-900 dark:text-slate-50 transition-colors">
      <div className="w-full max-w-md space-y-8 rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-2xl">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-block text-2xl font-black text-primary font-[var(--font-display)]">
            Travailleren<span className="text-gray-900 dark:text-white">Ci</span>
          </Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Connexion à votre espace</h1>
          <p className="text-xs text-gray-500 dark:text-slate-400">Accédez à votre tableau de bord candidat ou recruteur</p>
        </div>

        {error ? (
          <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-4 text-xs text-rose-600 dark:text-rose-300">
            {error}
          </div>
        ) : null}

        {resetSent ? (
          <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-xs text-emerald-700 dark:text-emerald-300 space-y-2">
            <div className="font-bold">Demande envoyée</div>
            <p>
              Si un compte existe pour <strong>{resetEmail}</strong>, un lien de
              réinitialisation du mot de passe lui a été envoyé.
            </p>
            <button
              type="button"
              onClick={() => {
                setShowForgot(false);
                setResetSent(false);
                setResetEmail("");
              }}
              className="text-primary font-bold hover:underline"
            >
              Retour à la connexion
            </button>
          </div>
        ) : showForgot ? (
          <form onSubmit={handleForgotPassword} className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 p-5 space-y-4">
            <div>
              <h2 className="font-bold text-sm text-gray-900 dark:text-white mb-1">Mot de passe oublié ?</h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Saisissez l'email de votre compte : nous vous enverrons un lien de réinitialisation.
              </p>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                Email du compte
              </label>
              <input
                type="email"
                required
                placeholder="vous@exemple.ci"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="w-full rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={resetLoading}
                className="flex-1 rounded-2xl bg-primary py-3 text-xs font-bold text-white hover:brightness-110 transition-all disabled:opacity-50"
              >
                {resetLoading ? "Envoi en cours..." : "Envoyer le lien"}
              </button>
              <button
                type="button"
                onClick={() => setShowForgot(false)}
                className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white font-semibold"
              >
                Annuler
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="space-y-3">
              <label className="block text-xs font-bold text-gray-700 dark:text-slate-400 uppercase tracking-widest">
                Connexion en tant que :
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRoleOverride("candidate")}
                  className={`rounded-2xl border p-3 text-center transition-all text-xs font-bold ${
                    roleOverride === "candidate"
                      ? "border-primary bg-primary/10 text-primary dark:text-white shadow-lg shadow-primary/10"
                      : "border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 text-gray-700 dark:text-slate-400 hover:border-gray-300 dark:hover:border-slate-700"
                  }`}
                >
                  Candidat
                </button>
                <button
                  type="button"
                  onClick={() => setRoleOverride("company")}
                  className={`rounded-2xl border p-3 text-center transition-all text-xs font-bold ${
                    roleOverride === "company"
                      ? "border-primary bg-primary/10 text-primary dark:text-white shadow-lg shadow-primary/10"
                      : "border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 text-gray-700 dark:text-slate-400 hover:border-gray-300 dark:hover:border-slate-700"
                  }`}
                >
                  Entreprise
                </button>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4 pt-2">
              <div>
                <label className="block text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="vous@exemple.ci"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <PasswordInput
                  label="Mot de passe"
                  value={password}
                  onChange={setPassword}
                  autoComplete="current-password"
                />
                <div className="flex justify-end mt-1 pr-1">
                  <button
                    type="button"
                    onClick={() => setShowForgot(true)}
                    className="text-[11px] font-semibold text-primary hover:underline"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-primary py-3.5 text-xs font-bold text-white hover:brightness-110 transition-all shadow-lg shadow-primary/20 mt-2 disabled:opacity-50"
              >
                {loading ? "Connexion..." : "Se connecter"}
              </button>
            </form>

            {isGoogleAuthVisible() && (
              <>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200 dark:border-slate-800" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white dark:bg-slate-900 px-2 text-gray-500 dark:text-slate-400">
                      Ou continuer avec
                    </span>
                  </div>
                </div>

                <a
                  href={googleAuthHref()}
                  className="w-full rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 py-3.5 px-4 text-xs font-bold text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.1 8.9 5 12 5z" />
                    <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z" />
                    <path fill="#FBBC05" d="M5.3 14.7c-.2-.7-.4-1.5-.4-2.7s.2-2 .4-2.7L1.6 6.4C.6 8.4 0 10.1 0 12s.6 3.6 1.6 5.6l3.7-2.9z" />
                    <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5.3L1.6 15.6C3.5 19.4 7.4 23 12 23z" />
                  </svg>
                  Se connecter avec Google
                </a>
              </>
            )}

            <div className="text-center text-xs text-gray-500 dark:text-slate-400">
              Pas encore de compte ?{" "}
              <Link href="/register" className="text-primary font-bold hover:underline">
                S'inscrire
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
