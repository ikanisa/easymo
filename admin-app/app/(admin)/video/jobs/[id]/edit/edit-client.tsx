"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  Mutation,
  ShotPlan,
} from "@easymo/video-agent-schema";
import clsx from "clsx";

interface EditJobClientProps {
  jobId: string;
  initialPlan: ShotPlan;
}

interface EditResponsePayload {
  parent: ShotPlan;
  child: ShotPlan;
  result: {
    ok?: boolean;
    data?: {
      stitchedPath: string;
      scenes: { sceneId: string; outputPath: string }[];
      captioning?: {
        bundles: {
          language: string;
          burnedInPath: string;
          srtPath: string;
          vttPath: string;
        }[];
      };
    };
  };
}

function parseLanguages(value: string): string[] {
  return value
    .split(",")
    .map((lang) => lang.trim())
    .filter(Boolean);
}

function normaliseRenderResult(payload: EditResponsePayload | null) {
  if (!payload?.result) return null;
  if (payload.result.data) {
    return payload.result.data;
  }
  return payload.result as unknown as EditResponsePayload["result"]["data"];
}

export default function EditJobClient({
  jobId,
  initialPlan,
}: EditJobClientProps) {
  const [selectedSceneId, setSelectedSceneId] = useState(
    initialPlan.scenes[0]?.id ?? "",
  );
  const defaultShotId = initialPlan.scenes[0]?.shots[0]?.id ?? "";
  const [selectedShotId, setSelectedShotId] = useState(defaultShotId);
  const [trimStart, setTrimStart] = useState<string>("0");
  const [trimEnd, setTrimEnd] = useState<string>("4");
  const [hookText, setHookText] = useState<string>(
    initialPlan.scenes[0]?.captionHints?.prompt ?? "",
  );
  const [ctaAsset, setCtaAsset] = useState<string>(
    initialPlan.scenes[0]?.overlays?.find((o) => o.type === "cta")?.src ??
      "",
  );
  const [languagesInput, setLanguagesInput] = useState<string>(
    initialPlan.scenes
      .flatMap((scene) => [
        scene.captionHints?.defaultLanguage,
        ...(scene.captionHints?.additionalLanguages ?? []),
      ])
      .filter(Boolean)
      .join(", ") ?? "en",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<EditResponsePayload | null>(null);

  const activeScene = useMemo(
    () => initialPlan.scenes.find((scene) => scene.id === selectedSceneId),
    [initialPlan.scenes, selectedSceneId],
  );

  const activeShot = useMemo(
    () => activeScene?.shots.find((shot) => shot.id === selectedShotId),
    [activeScene?.shots, selectedShotId],
  );

  useEffect(() => {
    const scene = initialPlan.scenes.find((entry) => entry.id === selectedSceneId);
    if (scene) {
      setHookText(scene.captionHints?.prompt ?? "");
      const cta = scene.overlays?.find((overlay) => overlay.type === "cta");
      setCtaAsset(cta?.src ?? "");
      const firstShot = scene.shots[0];
      if (firstShot) {
        setSelectedShotId(firstShot.id);
        setTrimStart(String(firstShot.startOffset ?? 0));
        setTrimEnd(String(firstShot.trimTo ?? firstShot.duration));
      }
    }
  }, [initialPlan.scenes, selectedSceneId]);

  useEffect(() => {
    if (activeShot) {
      setTrimStart(String(activeShot.startOffset ?? 0));
      setTrimEnd(String(activeShot.trimTo ?? activeShot.duration));
    }
  }, [activeShot]);

  const editedPlan = response?.child ?? initialPlan;
  const renderOutcome = normaliseRenderResult(response);

  async function submitMutation(mutation: Mutation) {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/video/edits", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          parentPlan: editedPlan,
          mutation,
          languages: parseLanguages(languagesInput),
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.error ?? "Failed to process edit");
      }
      setResponse(payload.data as EditResponsePayload);
    } catch (cause) {
      console.error(cause);
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Video job {jobId}</h1>
        <p className="text-muted-foreground">
          Review scene-level edits, generate captioned renders, and approve the
          resulting deliverable before publishing.
        </p>
      </header>

      <section className="grid gap-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Scene controls</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium">Scene</span>
            <select
              value={selectedSceneId}
              onChange={(event) => {
                const sceneId = event.target.value;
                setSelectedSceneId(sceneId);
                const firstShot = initialPlan.scenes
                  .find((scene) => scene.id === sceneId)
                  ?.shots?.[0]?.id;
                if (firstShot) {
                  setSelectedShotId(firstShot);
                }
              }}
              className="rounded border border-border bg-background px-3 py-2 text-sm"
            >
              {initialPlan.scenes.map((scene) => (
                <option key={scene.id} value={scene.id}>
                  {scene.order}. {scene.id}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium">Shot</span>
            <select
              value={selectedShotId}
              onChange={(event) => setSelectedShotId(event.target.value)}
              className="rounded border border-border bg-background px-3 py-2 text-sm"
            >
              {activeScene?.shots.map((shot) => (
                <option key={shot.id} value={shot.id}>
                  {shot.id} ({shot.duration.toFixed(1)}s)
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium">Trim start (s)</span>
            <input
              type="number"
              step="0.1"
              min={0}
              value={trimStart}
              onChange={(event) => setTrimStart(event.target.value)}
              className="rounded border border-border bg-background px-3 py-2 text-sm"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium">Trim end (s)</span>
            <input
              type="number"
              step="0.1"
              min={0}
              value={trimEnd}
              onChange={(event) => setTrimEnd(event.target.value)}
              className="rounded border border-border bg-background px-3 py-2 text-sm"
            />
          </label>

          <button
            type="button"
            disabled={isSubmitting || !selectedSceneId || !selectedShotId}
            onClick={() =>
              submitMutation({
                type: "trim",
                sceneId: selectedSceneId,
                shotId: selectedShotId,
                trimStart: Number(trimStart) || 0,
                trimEnd: Number(trimEnd) || activeShot?.duration || 0,
              })
            }
            className={clsx(
              "mt-6 inline-flex h-10 items-center justify-center rounded border px-4 text-sm font-medium transition",
              isSubmitting
                ? "cursor-not-allowed bg-muted text-muted-foreground"
                : "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            Apply trim
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium">Hook rewrite</span>
            <textarea
              value={hookText}
              onChange={(event) => setHookText(event.target.value)}
              rows={4}
              className="rounded border border-border bg-background px-3 py-2 text-sm"
            />
          </label>

          <div className="flex flex-col gap-4">
            <button
              type="button"
              disabled={isSubmitting || !selectedSceneId}
              onClick={() =>
                submitMutation({
                  type: "hook_rewrite",
                  sceneId: selectedSceneId,
                  text: hookText,
                })
              }
              className={clsx(
                "inline-flex h-10 items-center justify-center rounded border px-4 text-sm font-medium transition",
                isSubmitting
                  ? "cursor-not-allowed bg-muted text-muted-foreground"
                  : "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
              )}
            >
              Rewrite hook copy
            </button>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium">CTA asset</span>
              <input
                type="text"
                value={ctaAsset}
                onChange={(event) => setCtaAsset(event.target.value)}
                className="rounded border border-border bg-background px-3 py-2 text-sm"
              />
            </label>

            <button
              type="button"
              disabled={isSubmitting || !selectedSceneId || !ctaAsset.trim()}
              onClick={() =>
                submitMutation({
                  type: "cta_swap",
                  sceneId: selectedSceneId,
                  asset: ctaAsset,
                })
              }
              className={clsx(
                "inline-flex h-10 items-center justify-center rounded border px-4 text-sm font-medium transition",
                isSubmitting
                  ? "cursor-not-allowed bg-muted text-muted-foreground"
                  : "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
              )}
            >
              Swap CTA overlay
            </button>
          </div>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Caption languages</span>
          <input
            type="text"
            value={languagesInput}
            onChange={(event) => setLanguagesInput(event.target.value)}
            placeholder="en, es, fr"
            className="rounded border border-border bg-background px-3 py-2 text-sm"
          />
        </label>

        {error ? (
          <p className="rounded border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </section>

      <section className="grid gap-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Comparison</h2>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Original render
            </h3>
            <video
              controls
              className="aspect-video w-full rounded border border-border bg-black"
              src={initialPlan.outputPath}
            />
            <pre className="max-h-80 overflow-auto rounded border border-border bg-background p-4 text-xs">
              {JSON.stringify(initialPlan, null, 2)}
            </pre>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Edited preview
            </h3>
            <video
              controls
              className="aspect-video w-full rounded border border-border bg-black"
              src={renderOutcome?.stitchedPath ?? initialPlan.outputPath}
            />
            <pre className="max-h-80 overflow-auto rounded border border-border bg-background p-4 text-xs">
              {JSON.stringify(editedPlan, null, 2)}
            </pre>
          </div>
        </div>

        {renderOutcome?.captioning?.bundles?.length ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Caption bundles
            </h3>
            <table className="w-full table-auto text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="px-2 py-1">Language</th>
                  <th className="px-2 py-1">Burned-in</th>
                  <th className="px-2 py-1">SRT</th>
                  <th className="px-2 py-1">VTT</th>
                </tr>
              </thead>
              <tbody>
                {renderOutcome.captioning.bundles.map((bundle) => (
                  <tr key={bundle.language} className="border-t border-border">
                    <td className="px-2 py-2 font-medium">{bundle.language}</td>
                    <td className="px-2 py-2">
                      <a
                        href={bundle.burnedInPath}
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        {bundle.burnedInPath}
                      </a>
                    </td>
                    <td className="px-2 py-2">
                      <a
                        href={bundle.srtPath}
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        Download
                      </a>
                    </td>
                    <td className="px-2 py-2">
                      <a
                        href={bundle.vttPath}
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        Download
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Approval checklist</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-6 text-sm">
          <li>Confirm the hook messaging matches the creative brief.</li>
          <li>Verify CTA overlays respect safe-zone guidance and LUT styling.</li>
          <li>
            Review captioned renders for timing accuracy across all requested
            languages.
          </li>
          <li>Approve to publish or request additional revisions.</li>
        </ol>
      </section>
    </div>
  );
}
