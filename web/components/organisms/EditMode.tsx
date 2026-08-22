"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Check, Pencil, X } from "lucide-react";
import type { SettingKey } from "@/lib/settings";

// Lets a signed-in admin correct the site's copy where it appears, instead of
// hunting for the right field in a form. The back-office form stays: it holds
// things that aren't visible on the page (the SEO description) and the pop-up
// switch. This is for the sentences you notice while browsing.

type EditContext = {
  isAdmin: boolean;
  editing: boolean;
  setEditing: (on: boolean) => void;
};

const Ctx = createContext<EditContext>({
  isAdmin: false,
  editing: false,
  setEditing: () => {},
});

// Editing is opt-in rather than always-on: an admin spends most of their time
// simply looking at the gallery, and a page where every sentence is a text
// field invites edits nobody meant to make.
export function EditModeProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Deliberately after paint: the visitor's page must never wait on this.
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => !cancelled && setIsAdmin(Boolean(d.email)))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Ctx.Provider value={{ isAdmin, editing, setEditing }}>
      {children}
      {isAdmin && <EditToolbar editing={editing} setEditing={setEditing} />}
    </Ctx.Provider>
  );
}

export const useEditMode = () => useContext(Ctx);

function EditToolbar({
  editing,
  setEditing,
}: {
  editing: boolean;
  setEditing: (on: boolean) => void;
}) {
  return (
    <div className="fixed bottom-4 left-1/2 z-[70] -translate-x-1/2">
      <button
        type="button"
        onClick={() => setEditing(!editing)}
        className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-lg transition-colors ${
          editing
            ? "bg-foreground text-background"
            : "border border-foreground/15 bg-background text-foreground/70 hover:text-foreground"
        }`}
      >
        {editing ? (
          <>
            <X className="h-4 w-4" aria-hidden />
            Quitter l&apos;édition
          </>
        ) : (
          <>
            <Pencil className="h-4 w-4" aria-hidden />
            Modifier les textes
          </>
        )}
      </button>
    </div>
  );
}

// --- un texte modifiable --------------------------------------------------

// Saved values are kept in a module-level store so that a text edited in the
// sidebar also updates inside the pop-up, which renders the same setting
// elsewhere in the tree.
const overrides = new Map<string, string>();
const listeners = new Set<() => void>();

function setOverride(key: string, value: string) {
  overrides.set(key, value);
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function EditableText({
  settingKey,
  value,
  multiline = false,
  className = "",
}: {
  settingKey: SettingKey;
  value: string;
  multiline?: boolean;
  className?: string;
}) {
  const { editing } = useEditMode();
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const current = useSyncExternalStore(
    subscribe,
    () => overrides.get(settingKey) ?? value,
    () => value // server render: the value that came with the page
  );

  const save = useCallback(async () => {
    if (draft === null || draft === current) {
      setDraft(null);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [settingKey]: draft }),
      });
      if (!res.ok) throw new Error();
      setOverride(settingKey, draft);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1800);
    } catch {
      // The field keeps the text rather than silently reverting it, so
      // nothing typed is lost to a failed request.
      return;
    } finally {
      setSaving(false);
      setDraft(null);
    }
  }, [draft, current, settingKey]);

  if (!editing) return <>{current}</>;

  const shared =
    "w-full rounded-sm bg-foreground/5 outline-none ring-1 ring-foreground/20 focus:ring-foreground/60 disabled:opacity-60";

  return (
    <span className="relative block">
      {multiline ? (
        <textarea
          value={draft ?? current}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          disabled={saving}
          rows={3}
          className={`${shared} resize-y ${className}`}
        />
      ) : (
        <input
          value={draft ?? current}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          // Enter commits; Escape abandons what was typed.
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setDraft(null);
              e.currentTarget.blur();
            }
          }}
          disabled={saving}
          className={`${shared} ${className}`}
        />
      )}
      {justSaved && (
        <Check
          className="absolute -right-5 top-1 h-3.5 w-3.5 text-foreground/50"
          aria-hidden
        />
      )}
    </span>
  );
}
