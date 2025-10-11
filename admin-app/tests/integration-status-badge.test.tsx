import { render, screen } from "./utils/react-testing";
import { IntegrationStatusBadge } from "@/components/ui/IntegrationStatusBadge";

describe("IntegrationStatusBadge", () => {
  it("renders healthy state copy", () => {
    render(
      <IntegrationStatusBadge
        integration={{ target: "voucherSend", status: "ok" }}
      />,
    );
    expect(screen.getByText("voucherSend")).toBeInTheDocument();
    expect(screen.getByText("Integration healthy")).toBeInTheDocument();
  });

  it("renders degraded details", () => {
    render(
      <IntegrationStatusBadge
        integration={{
          target: "voucherSend",
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
