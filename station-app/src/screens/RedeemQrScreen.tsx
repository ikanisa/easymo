import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useRedeemQueue } from "@station/hooks/useRedeemQueue";
import "@station/styles/redeem.css";

export const RedeemQrScreen = () => {
  const { redeem } = useRedeemQueue();
  const navigate = useNavigate();
  const [scannerActive, setScannerActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!scannerActive) {
      return;
    }
    inputRef.current?.focus();
  }, [scannerActive]);

  const handleSubmit = async () => {
    if (!inputRef.current) {
      return;
    }
    const raw = inputRef.current.value.trim();
    if (!raw) {
      setError("Scan the QR code to populate the voucher.");
      return;
    }

    setError(null);
    try {
      await redeem({ voucherCode: raw, method: "qr", context: { source: "qr_scan" } });
      navigate("/redeem/result", { replace: true, state: { from: "qr" } });
    } catch (redeemError) {
      console.error("station.redeem.qr.error", redeemError);
      setError("Redeem failed. Hold steady and try again.");
    }
  };

  return (
    <div className="redeem">
      <section className="redeem-card" aria-labelledby="redeem-qr-title">
        <div className="redeem-card__header">
          <h1 id="redeem-qr-title">Scan voucher QR</h1>
          <p>Point the device at the QR code or use a tethered scanner.</p>
        </div>
        <div className="redeem-card__body">
          <button
            type="button"
            className="redeem-card__button"
            onClick={() => setScannerActive(true)}
            aria-pressed={scannerActive}
          >
            {scannerActive ? "Scanner ready" : "Start scanning"}
          </button>
          <p className="redeem-card__instruction">
            QR scanner feeds characters into the field below. We mask MSISDN automatically.
          </p>
          <input
            ref={inputRef}
            className="redeem-card__input"
            placeholder="Voucher code appears here"
            aria-label="Scanned voucher code"
            aria-live="polite"
          />
          <button type="button" className="redeem-card__submit" onClick={handleSubmit}>
            Confirm redeem
          </button>
          {error ? <p className="redeem-card__error" role="alert">{error}</p> : null}
        </div>
        <footer className="redeem-card__footer">
          <p>Having camera trouble? Switch to manual entry.</p>
        </footer>
      </section>
    </div>
  );
};
