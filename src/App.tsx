"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Download,
  FileArchive,
  Loader2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type JSZip from "jszip";

import { Dropzone } from "@/components/Dropzone";
import { Dashboard } from "@/components/Dashboard";
import { loadPptx, type MediaImage } from "@/lib/pptx";

type Session = {
  file: File;
  zip: JSZip;
  images: MediaImage[];
};

export type AppProps = {
  /**
   * URL (relative or absolute) of the standalone single-file HTML build.
   * When provided, a "Download standalone HTML" button appears in the
   * header. When running from file:// (the standalone build) the button
   * is hidden automatically.
   */
  standaloneHtmlUrl?: string;
};

export default function App({
  standaloneHtmlUrl = "/ppt-downsizer.html",
}: AppProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStandalone, setIsStandalone] = useState<boolean | null>(null);
  const [downloadingHtml, setDownloadingHtml] = useState(false);

  useEffect(() => {
    const handle = requestAnimationFrame(() => {
      setIsStandalone(window.location.protocol === "file:");
    });
    return () => cancelAnimationFrame(handle);
  }, []);

  const handleFile = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const { zip, images } = await loadPptx(file);
      setSession({ file, zip, images });
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? `Could not read .pptx: ${err.message}`
          : "Could not read this .pptx file."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    if (session) {
      for (const img of session.images) URL.revokeObjectURL(img.previewUrl);
    }
    setSession(null);
    setError(null);
  }, [session]);

  useEffect(() => {
    return () => {
      if (session) {
        for (const img of session.images) URL.revokeObjectURL(img.previewUrl);
      }
    };
  }, [session]);

  const handleDownloadStandalone = useCallback(async () => {
    if (!standaloneHtmlUrl) return;
    setDownloadingHtml(true);
    try {
      const res = await fetch(standaloneHtmlUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ppt-downsizer.html";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err) {
      console.error("Failed to download standalone HTML", err);
      window.open(standaloneHtmlUrl, "_blank", "noopener,noreferrer");
    } finally {
      setDownloadingHtml(false);
    }
  }, [standaloneHtmlUrl]);

  const showStandaloneButton = !!standaloneHtmlUrl && isStandalone === false;

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(120,119,198,0.18),transparent_80%)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(120,119,198,0.25),transparent_80%)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-zinc-300 to-transparent dark:via-zinc-700" />

      <div className="mx-auto flex w-full max-w-6xl flex-col px-6 py-10 sm:py-16">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-950 text-white shadow-sm dark:bg-white dark:text-zinc-950">
              <FileArchive className="h-4 w-4" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-base font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                PPT Downsizer
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Shrink .pptx files in your browser
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600 sm:inline-flex dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
              <Sparkles className="h-3 w-3" />
              100% client-side
            </span>
            <span className="hidden items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600 sm:inline-flex dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
              <ShieldCheck className="h-3 w-3" />
              No uploads
            </span>
            {showStandaloneButton && (
              <button
                type="button"
                onClick={handleDownloadStandalone}
                disabled={downloadingHtml}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-100 hover:text-zinc-950 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-white"
                title="Download a single-file HTML copy of this tool to share offline"
              >
                {downloadingHtml ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Share as HTML
              </button>
            )}
          </div>
        </header>

        <main className="mt-10 flex flex-1 flex-col gap-10">
          <AnimatePresence mode="wait">
            {!session ? (
              <motion.section
                key="upload"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
                className="mx-auto flex w-full max-w-3xl flex-col gap-8"
              >
                <div className="text-center">
                  <motion.h1
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05, duration: 0.3 }}
                    className="text-balance text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl dark:text-zinc-50"
                  >
                    Optimize your PowerPoint in seconds.
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12, duration: 0.3 }}
                    className="mx-auto mt-4 max-w-xl text-balance text-base text-zinc-600 dark:text-zinc-400"
                  >
                    Drop in a .pptx file and shrink its embedded images with
                    fine-grained control. Files never leave your browser.
                  </motion.p>
                </div>

                <Dropzone
                  onFile={handleFile}
                  loading={loading}
                  error={error}
                />

                <Features showStandaloneTip={showStandaloneButton} />
              </motion.section>
            ) : (
              <motion.section
                key="dashboard"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
              >
                <Dashboard
                  file={session.file}
                  zip={session.zip}
                  images={session.images}
                  onReset={handleReset}
                />
              </motion.section>
            )}
          </AnimatePresence>
        </main>

        <footer className="mt-16 flex flex-col items-center justify-between gap-3 border-t border-zinc-200 pt-6 text-xs text-zinc-500 sm:flex-row dark:border-zinc-800 dark:text-zinc-400">
          <span>Built with Next.js, Tailwind, and a bit of magic.</span>
          <span>
            Works entirely offline. Your files stay on this device.
          </span>
        </footer>
      </div>
    </div>
  );
}

function Features({ showStandaloneTip }: { showStandaloneTip: boolean }) {
  const items = [
    {
      title: "Per-image control",
      body: "Tune compression on a slide-by-slide basis or apply a global ratio across the whole deck.",
    },
    {
      title: "Live size estimates",
      body: "See the projected image size as you move each slider, without committing to anything.",
    },
    {
      title: showStandaloneTip ? "Shareable as one file" : "Private by design",
      body: showStandaloneTip
        ? "Download the single-file HTML version and send it to anyone. It runs offline - just open it in a browser."
        : "Everything runs locally in your browser. Nothing is uploaded to a server.",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.title}
          className="rounded-xl border border-zinc-200/80 bg-white/60 p-4 backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-950/60"
        >
          <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            {item.title}
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {item.body}
          </div>
        </div>
      ))}
    </div>
  );
}
