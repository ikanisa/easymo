import type { Metadata } from "next";
import { SupportChat } from "./SupportChat";

export const metadata: Metadata = {
  title: "Support Chat",
  description: "Chat with Sales, Marketing, and Support AI agents",
};

export default function SupportPage() {
  return (
    <div className="panel-page">
      <div className="panel-page__header">
        <div className="panel-page__header-content">
          <h1 className="panel-page__title">Support Chat</h1>
          <p className="panel-page__description">
            Get assistance from our Sales, Marketing, and Support AI agents
          </p>
        </div>
      </div>
      <div className="panel-page__body">
        <SupportChat />
      </div>
    </div>
  );
}
