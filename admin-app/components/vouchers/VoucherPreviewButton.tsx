"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { VoucherCardPreview } from "./VoucherCardPreview";
import type { Voucher } from "@/lib/schemas";
import styles from "./VoucherPreviewButton.module.css";
import { IntegrationStatusBadge } from "@/components/ui/IntegrationStatusBadge";
import { Button } from "@/components/ui/Button";
import { getAdminApiPath } from "@/lib/routes";

interface VoucherPreviewButtonProps {
  voucher: Voucher;
}

export function VoucherPreviewButton({ voucher }: VoucherPreviewButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [integration, setIntegration] = useState<
    {
      target: string;
      status: "ok" | "degraded";
      reason?: string;
      message?: string;
    } | null
  >(null);
  const [preview, setPreview] = useState<
    {
      imageUrl?: string | null;
      pdfUrl?: string | null;
      expiresAt?: string | null;
    } | null
  >(null);

  const openPreview = async () => {
    setIsOpen(true);
    setStatusMessage(null);
    setIntegration(null);
    try {
      const response = await fetch(getAdminApiPath("vouchers", "preview"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voucherId: voucher.id }),
      });
      if (response.ok) {
        const data = await response.json();
        setIntegration(data.integration ?? null);
        setPreview({
          imageUrl: data.imageUrl ?? null,
          pdfUrl: data.pdfUrl ?? null,
          expiresAt: data.expiresAt ?? null,
        });
        if (data.status === "degraded" || data.status === "not_configured") {
          setStatusMessage(
            data.message ??
              "Voucher preview running in degraded mode. Showing design mock.",
          );
        } else if (typeof data.message === "string") {
          setStatusMessage(data.message);
        } else {
          setStatusMessage(null);
        }
      } else {
        setStatusMessage(
          "Unable to reach preview service. Showing design mock instead.",
        );
      }
    } catch (error) {
      console.error("Voucher preview failed", error);
      setStatusMessage("Preview request failed. Showing design mock instead.");
    }
  };

  return (
    <>
      <Button type="button" variant="outline" onClick={openPreview}>
        Preview voucher
      </Button>
      {isOpen
        ? (
          <Modal title="Voucher preview" onClose={() => setIsOpen(false)}>
            {integration
              ? (
                <IntegrationStatusBadge
                  integration={integration}
                  label="Preview bridge"
                />
              )
              : null}
            {statusMessage
              ? <p className={styles.status}>{statusMessage}</p>
              : null}
            <VoucherCardPreview
              amount={voucher.amount}
              currency={voucher.currency}
              code={voucher.code ?? "-----"}
              expiresAt={preview?.expiresAt ?? voucher.expiresAt}
              barName={voucher.stationScope ?? undefined}
            />
            {preview?.imageUrl
              ? (
                <a
                  className={styles.downloadLink}
                  href={preview.imageUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Download preview image
                </a>
              )
              : null}
            {preview?.pdfUrl
              ? (
                <a
                  className={styles.downloadLink}
                  href={preview.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Download PDF preview
                </a>
              )
              : null}
          </Modal>
        )
        : null}
    </>
  );
}
