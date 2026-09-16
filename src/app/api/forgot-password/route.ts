"use server";

import { createBrowserAuthClient } from "@/lib/supabase/browser";
import { redirect } from "next/navigation";

export async function POST(request: Request) {
  const body = await request.json();
  const { email } = body;

  if (!email || !email.trim()) {
    return new Response(
      JSON.stringify({ error: "Please enter your email address." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const client = createBrowserAuthClient();
    const { error } = await client.auth.resetPasswordForEmail(email.trim());

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message ?? "Something went wrong." }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Success: show privacy-safe response
    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Something went wrong. Please try again.";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}