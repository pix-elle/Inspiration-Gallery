import type { ReactNode } from "react";
import { Logo } from "@/components/atoms/Logo";
import { SubscribeButton } from "@/components/atoms/SubscribeButton";
import { Sidebar } from "@/components/organisms/Sidebar";
import { SubscribeModal } from "@/components/organisms/SubscribeModal";
import { getSettings, isOn } from "@/lib/settings";
import { EditModeProvider } from "@/components/organisms/EditMode";

export async function AppShell({ children }: { children: ReactNode }) {
  // Read once here and passed down: the copy is editable from /admin, and a
  // server component is the only place that can read it without shipping a
  // database call to the browser.
  const settings = await getSettings();

  return (
    <EditModeProvider>
      <div className="min-h-dvh">
      {/* Desktop: fixed left sidebar */}
      <Sidebar settings={settings} />
      {/* Mobile: slim top bar instead of the sidebar */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-foreground/10 bg-background/80 p-3 backdrop-blur md:hidden">
        <Logo />
        <SubscribeButton
          label={settings.subscribeButtonLabelShort}
          className="px-3 py-1.5"
        />
      </header>
      <main className="p-4 md:ml-56 md:p-6">{children}</main>
      <SubscribeModal
        autoOpen={isOn(settings.newsletterPopupEnabled)}
        delaySeconds={Number(settings.newsletterPopupDelaySeconds) || 8}
        title={settings.newsletterPopupTitle}
        successMessage={settings.newsletterPopupSuccess}
        buttonLabel={settings.subscribeButtonLabelShort}
        />
      </div>
    </EditModeProvider>
  );
}
