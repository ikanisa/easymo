import { ActionCard } from "@station/components/ActionCard";
import "@station/styles/home.css";

export const HomeScreen = () => (
  <div className="home">
    <header className="home__header">
      <h1>Redeem vouchers quickly</h1>
      <p>Choose how you want to redeem or review today&apos;s performance.</p>
    </header>
    <section className="home__grid" aria-label="Primary actions">
      <ActionCard to="/redeem/qr" title="Scan QR" description="Use the camera to scan voucher QR codes." icon="📷" />
      <ActionCard to="/redeem/code" title="Enter code" description="Type the 5-digit voucher code." icon="⌨️" />
      <ActionCard to="/balance" title="Balance" description="Check tokens available to redeem." icon="💰" />
      <ActionCard to="/history" title="History" description="Review today&apos;s redemption log." icon="🕒" />
    </section>
  </div>
);
