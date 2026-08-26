"use client";

import { useState } from "react";
import { toast } from "sonner";
import { GoogleIcon } from "@/components/icons/GoogleIcon";
import { buildAuthCallbackUrl } from "@/features/auth/lib/authUrl";
import { createClient } from "@/lib/supabase/client";

type Props = {
  next?: string;
  label?: string;
};

export function GoogleSignInButton({ next = "/feed", label = "Continuar com Google" }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const supabase = createClient();
    const redirectTo = buildAuthCallbackUrl(next);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, queryParams: { prompt: "select_account" } },
    });
    if (error) {
      setLoading(false);
      toast.error("Falha ao iniciar login", { description: error.message });
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="inline-flex w-full items-center justify-center gap-3 rounded-[24px] border border-auth-btn-border bg-white px-[22px] py-[16px] text-[14px] font-medium text-scriba-ink-strong shadow-[0_4px_14px_rgba(79,168,240,.08)] transition-colors font-[var(--font-poppins),system-ui,sans-serif] hover:border-auth-btn-border-hover hover:bg-auth-btn-bg-hover disabled:cursor-not-allowed disabled:opacity-70"
    >
      <GoogleIcon />
      <span>{loading ? "Abrindo Google…" : label}</span>
    </button>
  );
}
