"use client";

import { useEffect, useState } from "react";
import { Clock, Download, Globe, Monitor } from "lucide-react";
import { AppleLogo, LinuxLogo, WindowsLogo } from "./platform-icons";

type Choice = "web" | "desktop";
const OPTIONS = [
  ["web", Globe, "Continue on web"],
  ["desktop", Monitor, "Download the app"],
] as const;

// Built from openbox-ventures-panel-desktop/ (electron-builder), hosted as GitHub release assets
// (repo releases/desktop-v1.0.0) so they don't bloat this repo.
const RELEASE = "https://github.com/ashutoshswamy/openbox-ventures-panel/releases/download/desktop-v1.0.0";
const DOWNLOADS = [
  {
    platform: "macOS",
    note: "11 or later · unsigned app, see note below",
    Logo: AppleLogo,
    variants: [
      { label: "Apple Silicon", href: `${RELEASE}/Open.Box.Ventures.LLP.Panel-1.0.0-arm64.dmg` },
      { label: "Intel", href: `${RELEASE}/Open.Box.Ventures.LLP.Panel-1.0.0.dmg` },
    ],
  },
  {
    platform: "Linux",
    note: "AppImage, any distro",
    Logo: LinuxLogo,
    variants: [
      { label: "x86_64", href: `${RELEASE}/Open.Box.Ventures.LLP.Panel-1.0.0.AppImage` },
      { label: "ARM64", href: `${RELEASE}/Open.Box.Ventures.LLP.Panel-1.0.0-arm64.AppImage` },
    ],
  },
  {
    platform: "Windows",
    note: "64-bit, Windows 10+ · unsigned app, see note below",
    Logo: WindowsLogo,
    variants: [{ label: "Download", href: `${RELEASE}/Open.Box.Ventures.LLP.Panel.Setup.1.0.0.exe` }],
  },
] as const;

export function HomeChoice({ signIn }: { signIn: React.ReactNode }) {
  const [choice, setChoice] = useState<Choice>("web");
  // desktop shell (main.js) uses Electron's default user agent, which always includes "Electron"
  const [isDesktopApp, setIsDesktopApp] = useState(false);

  useEffect(() => {
    setIsDesktopApp(navigator.userAgent.includes("Electron"));
  }, []);

  if (isDesktopApp) return signIn;

  return (
    <div>
      <div role="radiogroup" aria-label="Open the panel" className="mb-8 grid grid-cols-2 gap-1 rounded-lg border border-line bg-surface-2 p-1">
        {OPTIONS.map(([value, Icon, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={choice === value}
            onClick={() => setChoice(value)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-[background-color,color,transform] active:scale-[0.98] ${
              choice === value ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text"
            }`}
          >
            <Icon className="size-3.5" strokeWidth={2} />
            {label}
          </button>
        ))}
      </div>

      {choice === "web" ? (
        signIn
      ) : (
        <div className="rise space-y-3">
          {DOWNLOADS.map((d) => (
            <div key={d.platform} className="card flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <d.Logo className="size-5 shrink-0 text-muted" />
                <div>
                  <p className="font-medium">{d.platform}</p>
                  <p className="text-sm text-muted">{d.note}</p>
                </div>
              </div>
              {d.variants.length ? (
                <div className="flex gap-2">
                  {d.variants.map((v) => (
                    <a key={v.label} href={v.href} className="btn flex-1">
                      <Download /> {v.label}
                    </a>
                  ))}
                </div>
              ) : (
                <span className="badge shrink-0"><Clock /> Coming soon</span>
              )}
            </div>
          ))}
          <p className="text-xs text-muted">Same account, same data. Sign in once the app opens.</p>

          <div className="card space-y-2 text-xs text-muted">
            <p className="font-medium text-text">App is unsigned — one-time step to open it</p>
            <p><span className="font-medium text-text">macOS:</span> right-click the app → Open → confirm in the dialog. If that doesn&apos;t work, run in Terminal:</p>
            <code className="block overflow-x-auto rounded bg-surface-2 px-2 py-1.5 font-mono text-[11px] text-text">
              xattr -d com.apple.quarantine &quot;/Applications/Open Box Ventures LLP Panel.app&quot;
            </code>
            <p><span className="font-medium text-text">Windows:</span> on &quot;Windows protected your PC&quot;, click More info → Run anyway.</p>
          </div>
        </div>
      )}
    </div>
  );
}
