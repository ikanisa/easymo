import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useRedeemQueue } from "@station/hooks/useRedeemQueue";
import "@station/styles/forms.css";
import "@station/styles/redeem.css";

export const RedeemCodeScreen = () => {
  const { redeem } = useRedeemQueue();
  const navigate = useNavigate();
  const [voucherCode, setVoucherCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!voucherCode || voucherCode.length < 5) {
      setError("Enter the 5-digit voucher code.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await redeem({ voucherCode: voucherCode.toUpperCase(), method: "code" });
      navigate("/redeem/result", { replace: true, state: { from: "code" } });
    } catch (redeemError) {
      console.error("station.redeem.code.error", redeemError);
      setError("Redeem failed. Check the code and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="redeem">
      <form className="form-card" onSubmit={handleSubmit} aria-labelledby="redeem-code-title">
        <h1 id="redeem-code-title" className="form-card__title">
          Enter voucher code
        </h1>
        <p className="form-card__subtitle">Type the 5-digit code printed on the voucher.</p>
        <div className="form-field">
          <label htmlFor="voucherCode" className="form-label">
            Voucher code
          </label>
          <input
            id="voucherCode"
            className="form-input"
            value={voucherCode}
            onChange={(event) => setVoucherCode(event.target.value.replace(/[^0-9A-Z]/gi, "").slice(0, 5))}
            placeholder="12345"
            autoFocus
            inputMode="numeric"
            aria-describedby="voucher-helper"
          />
          <span id="voucher-helper" className="redeem__helper">
            Use the hardware keypad or scanner. Letters are accepted.
          </span>
        </div>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <button className="form-button" type="submit" disabled={submitting}>
          {submitting ? "Submitting…" : "Redeem"}
        </button>
        <p className="form-helper">We will retry automatically if the network drops.</p>
      </form>
    </div>
  );
};
