"use client";

import { useState } from "react";
import { toast } from "sonner";
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
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
        : `/auth/callback?next=${encodeURIComponent(next)}`;
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
      className="inline-flex w-full items-center justify-center gap-3 rounded-[24px] border bg-white transition-colors hover:bg-[#F6FAFE] hover:border-[#C9D9E8] disabled:cursor-not-allowed disabled:opacity-70"
      style={{
        borderColor: "#DFEAF4",
        color: "#33414F",
        fontFamily: "var(--font-poppins), system-ui, sans-serif",
        fontSize: 14,
        fontWeight: 500,
        padding: "16px 22px",
        boxShadow: "0 4px 14px rgba(79,168,240,.08)",
      }}
    >
      <GoogleIcon />
      <span>{loading ? "Abrindo Google…" : label}</span>
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      aria-hidden="true"
      className="size-5"
    >
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.1c-2 1.5-4.5 2.3-7.2 2.3-5.2 0-9.6-3.3-11.3-8l-6.6 5.1C9.6 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.2 5.1C41.6 35.4 44 30 44 24c0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}
