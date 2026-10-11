"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requestMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email || !email.includes("@")) {
    redirect("/login?error=invalid-email");
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithOtp({
    email,
  });

  if (error) {
    redirect("/login?error=send-failed");
  }

  redirect(`/login?sent=1&email=${encodeURIComponent(email)}`);
}
