"use client";

import { OptimizedImage } from "@/components/ui/optimized-image";
import { useCallback, useState, useTransition } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { useToast } from "@/providers/toast-provider";
import { useTranslation } from "@/providers/i18n-provider";

type SaccoRow = Database["app"]["Tables"]["saccos"]["Row"];

interface SaccoBrandingCardProps {
  // `brand_color` might not exist in current schema; treat as optional
  sacco: Pick<
    SaccoRow,
    "id" | "name" | "district" | "province" | "status" | "email" | "logo_url" | "category"
  > & { brand_color?: string | null };
}

const supabase = getSupabaseBrowserClient();

export function SaccoBrandingCard({ sacco }: SaccoBrandingCardProps) {
  const [pending, startTransition] = useTransition();
  const [logoUrl, setLogoUrl] = useState<string | null>(sacco.logo_url ?? null);
  const [brandColor, setBrandColor] = useState<string>(sacco.brand_color ?? "#009fdc");
  const { success, error } = useToast();
  const { t } = useTranslation();

  const notifySuccess = (msg: string) => success(msg);
  const notifyError = (msg: string) => error(msg);

  const patchBranding = useCallback(
    async (payload: Record<string, unknown>) => {
      const response = await fetch(`/api/admin/saccos/${sacco.id}/branding`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error ?? t("common.operationFailed", "Operation failed"));
      }
      return body as { logoUrl: string | null; brandColor: string | null };
    },
    [sacco.id, t]
  );

  const updateLogo = async (logoUrl: string | null) => {
    const result = await patchBranding({ logoUrl });
    notifySuccess(t("admin.branding.logoUpdated", "Logo updated"));
    setLogoUrl(result.logoUrl);
    if (result.brandColor) {
      setBrandColor(result.brandColor);
    }
  };

  const handleLogoUpload = (file: File) => {
    startTransition(async () => {
      const storagePath = `saccos/${sacco.id}/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("branding")
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: true,
        });
      if (uploadError) {
        notifyError(
          uploadError.message ?? t("admin.branding.logoUploadFailed", "Failed to upload logo")
        );
        return;
      }
      const {
        data: { publicUrl },
      } = supabase.storage.from("branding").getPublicUrl(storagePath);
      await updateLogo(publicUrl);
    });
  };

  const handleRemoveLogo = () => {
    startTransition(async () => {
      await updateLogo(null);
    });
  };

  const saveBrandColor = () => {
    const value = brandColor.trim();
    const valid = /^#?[0-9a-fA-F]{6}$/.test(value);
    if (!valid) {
      error(t("admin.branding.colorInvalid", "Enter a valid hex color (e.g., #00AACC)"));
      return;
    }
    const hex = value.startsWith("#") ? value : `#${value}`;
    startTransition(async () => {
      try {
        const result = await patchBranding({ brandColor: hex });
        success(t("admin.branding.colorUpdated", "Brand color updated"));
        setBrandColor(result.brandColor ?? hex);
      } catch (err) {
        notifyError(
          err instanceof Error ? err.message : t("common.operationFailed", "Operation failed")
        );
      }
    });
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-neutral-0">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-2">
            {t("admin.branding.profile", "SACCO Profile")}
          </p>
          <h3 className="text-lg font-semibold">{sacco.name}</h3>
          <p className="text-xs text-neutral-2">
            {sacco.district}, {sacco.province}
          </p>
          <p className="text-xs text-neutral-3">{sacco.category}</p>
          {sacco.email && <p className="text-xs text-neutral-2">{sacco.email}</p>}
        </div>
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <OptimizedImage
              src={logoUrl}
              alt={`${sacco.name} logo`}
              width={64}
              height={64}
              className="h-16 w-16 rounded-full border border-white/20 object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-white/20 text-xs text-neutral-2">
              {t("admin.branding.noLogo", "No logo")}
            </div>
          )}
          <label className="interactive-scale cursor-pointer rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-neutral-2">
            {t("admin.branding.upload", "Upload logo")}
            <input
              type="file"
              accept="image/png,image/jpeg,image/svg+xml"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                if (file.size > 1.5 * 1024 * 1024) {
                  notifyError(t("admin.branding.sizeLimit", "Logo must be under 1.5MB"));
                  return;
                }
                handleLogoUpload(file);
              }}
            />
          </label>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
        <label className="flex items-center gap-3 text-sm text-neutral-0">
          <span
            className="inline-block h-6 w-6 rounded"
            style={{
              backgroundColor: brandColor || "#009fdc",
              border: "1px solid rgba(255,255,255,0.2)",
            }}
            aria-hidden
          />
          <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
            {t("admin.branding.brandColor", "Brand color")}
          </span>
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={brandColor}
            onChange={(e) => setBrandColor(e.target.value)}
            placeholder="#00AACC"
            className="w-28 rounded-xl border border-white/10 bg-white/10 px-2 py-1 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
          />
          <button
            type="button"
            onClick={saveBrandColor}
            disabled={pending}
            className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-neutral-0 disabled:opacity-60"
          >
            {t("common.save", "Save")}
          </button>
        </div>
      </div>
      {logoUrl && (
        <button
          type="button"
          onClick={handleRemoveLogo}
          disabled={pending}
          className="self-start text-xs text-amber-200 underline-offset-2 hover:underline disabled:opacity-60"
        >
          {t("admin.branding.remove", "Remove logo")}
        </button>
      )}
    </div>
  );
}
