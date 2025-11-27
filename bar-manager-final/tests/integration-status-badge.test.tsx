import { describe, expect, it } from "vitest";

import { IntegrationStatusBadge } from "@/components/ui/IntegrationStatusBadge";

import { render, screen } from "./utils/react-testing";

describe("IntegrationStatusBadge", () => {
  it("renders healthy state copy", () => {
    render(
      <IntegrationStatusBadge
        integration={{ target: "whatsappSend", status: "ok" }}
      />,
    );
    expect(screen.getByText("whatsappSend")).toBeInTheDocument();
    expect(screen.getByText("Integration healthy")).toBeInTheDocument();
  });

  it("renders degraded details", () => {
    render(
      <IntegrationStatusBadge
        integration={{
          target: "whatsappSend",
          status: "degraded",
          reason: "bridge_down",
          message: "Bridge offline.",
        }}
      />,
    );
    expect(screen.getByText("Bridge offline.")).toBeInTheDocument();
    expect(screen.getByText("(bridge_down)")).toBeInTheDocument();
  });

  it("renders nothing when integration missing", () => {
    const { container } = render(<IntegrationStatusBadge integration={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
