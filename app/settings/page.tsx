import { readSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/settings/settings-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SettingsPage() {
  const settings = await readSettings();
  return (
    <div className="flex flex-1 flex-col gap-3 p-3">
      <h1 className="text-lg font-semibold text-zinc-100">Settings</h1>
      <p className="text-xs text-zinc-400 max-w-2xl">
        Tweak how strict the &ldquo;worth a look&rdquo; filter is, how big the pretend bankroll is for
        bet-size suggestions, and how often the dashboard refreshes. Everything saves locally and
        takes effect at the next refresh.
      </p>
      <SettingsForm initial={settings} />
    </div>
  );
}
