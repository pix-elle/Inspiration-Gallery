"use client";

import { useState } from "react";
import { Mail } from "lucide-react";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    await fetch("/api/auth/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    // Always "sent", whatever the answer: the server deliberately doesn't say
    // whether the address has access, and the screen must not say it either.
    setState("sent");
  }

  if (state === "sent") {
    return (
      <div className="flex flex-col gap-2 text-sm">
        <p className="font-medium">Regarde tes emails</p>
        <p className="text-foreground/60">
          Si <span className="text-foreground">{email}</span> a accès à
          l&apos;administration, un lien de connexion vient d&apos;y être
          envoyé. Il est valable 15 minutes.
        </p>
        <button
          type="button"
          onClick={() => setState("idle")}
          className="mt-2 self-start text-sm text-foreground/60 underline underline-offset-4 hover:text-foreground"
        >
          Essayer une autre adresse
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label htmlFor="email" className="text-sm text-foreground/60">
        Ton adresse email
      </label>
      <input
        id="email"
        type="email"
        required
        autoFocus
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="prenom@exemple.com"
        className="rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-foreground/40"
      />
      <button
        type="submit"
        disabled={state === "sending"}
        className="flex items-center justify-center gap-2 rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-60"
      >
        <Mail className="h-4 w-4" aria-hidden />
        {state === "sending" ? "Envoi…" : "Recevoir un lien de connexion"}
      </button>
    </form>
  );
}
