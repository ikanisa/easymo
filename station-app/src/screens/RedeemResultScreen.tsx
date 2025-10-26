import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useRedeemQueue } from "@station/hooks/useRedeemQueue";
import "@station/styles/result.css";

export const RedeemResultScreen = () => {
  const { lastResult } = useRedeemQueue();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!lastResult) {
      navigate("/redeem/code", { replace: true });
    }
  }, [lastResult, navigate]);

  if (!lastResult) {
    return null;
  }

  if (lastResult.status !== "redeemed" && lastResult.status !== "already_redeemed") {
    return (
      <section className="redeem-result" aria-live="assertive">
        <div className="redeem-result__card redeem-result__card--error">
          <h1>Redeem incomplete</h1>
          <p>{lastResult.message}</p>
          <button type="button" onClick={() => navigate("/redeem/code")}>Try another voucher</button>
        </div>
      </section>
    );
  }

  const heading = lastResult.status === "redeemed" ? "Voucher redeemed" : "Voucher already redeemed";

  return (
    <section className="redeem-result" aria-live="polite">
      <div className="redeem-result__card">
        <div className="redeem-result__icon" role="img" aria-label="Success">
          ✓
        </div>
        <h1>{heading}</h1>
        <p className="redeem-result__amount">
          {lastResult.amount.toLocaleString(undefined, { style: "currency", currency: lastResult.currency })}
        </p>
        <p className="redeem-result__msisdn" aria-label="Redeemed MSISDN masked">
          {lastResult.maskedMsisdn}
        </p>
        <dl className="redeem-result__meta">
          <div>
            <dt>Reference</dt>
            <dd>{lastResult.reference}</dd>
          </div>
          <div>
            <dt>Redeemed at</dt>
            <dd>{new Date(lastResult.redeemedAt).toLocaleString()}</dd>
          </div>
          <div>
            <dt>Flow</dt>
            <dd>{location.state?.from === "qr" ? "QR scan" : "Code entry"}</dd>
          </div>
        </dl>
        <div className="redeem-result__actions">
          <button type="button" onClick={() => navigate("/redeem/qr")}>Scan next</button>
          <button type="button" onClick={() => navigate("/redeem/code")}>Enter another code</button>
          <button type="button" onClick={() => navigate("/history")}>View history</button>
        </div>
      </div>
    </section>
  );
};
