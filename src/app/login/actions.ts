"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPublicEnv } from "@/lib/env";

export async function requestMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email || !email.includes("@")) {
    redirect("/login?error=invalid-email");
  }

  const supabase = await createClient();
  const env = getPublicEnv();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/projects`,
    },
  });

  if (error) {
    redirect("/login?error=send-failed");
  }

  redirect(`/login?sent=1&email=${encodeURIComponent(email)}`);
}
