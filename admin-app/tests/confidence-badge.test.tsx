import { describe, expect, it } from "vitest";

import { ConfidenceBadge } from "@/components/sms/ConfidenceBadge";

import { render, screen } from "../utils/react-testing";

describe("ConfidenceBadge", () => {
  it("renders high confidence (90%+) in green", () => {
    const { container } = render(<ConfidenceBadge confidence={0.95} />);
    expect(screen.getByText("95%")).toBeInTheDocument();
    expect(container.querySelector(".text-green-500")).toBeInTheDocument();
  });

  it("renders medium confidence (70-89%) in yellow", () => {
    const { container } = render(<ConfidenceBadge confidence={0.75} />);
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(container.querySelector(".text-yellow-500")).toBeInTheDocument();
  });

  it("renders low confidence (50-69%) in orange", () => {
    const { container } = render(<ConfidenceBadge confidence={0.55} />);
    expect(screen.getByText("55%")).toBeInTheDocument();
    expect(container.querySelector(".text-orange-500")).toBeInTheDocument();
  });

  it("renders very low confidence (<50%) in red", () => {
    const { container } = render(<ConfidenceBadge confidence={0.35} />);
    expect(screen.getByText("35%")).toBeInTheDocument();
    expect(container.querySelector(".text-red-500")).toBeInTheDocument();
  });

  it("renders dash when confidence is null", () => {
    const { container } = render(<ConfidenceBadge confidence={null} />);
    expect(container.textContent).toBe("—");
  });

  it("rounds confidence to nearest percentage", () => {
    render(<ConfidenceBadge confidence={0.876} />);
    expect(screen.getByText("88%")).toBeInTheDocument();
  });
});
