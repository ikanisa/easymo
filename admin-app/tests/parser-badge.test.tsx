import { describe, expect, it } from "vitest";

import { ParserBadge } from "@/components/sms/ParserBadge";

import { render, screen } from "../utils/react-testing";

describe("ParserBadge", () => {
  it("renders OpenAI parser badge", () => {
    render(<ParserBadge parser="openai" />);
    expect(screen.getByText("OpenAI")).toBeInTheDocument();
    expect(screen.getByText("🤖")).toBeInTheDocument();
  });

  it("renders Gemini parser badge", () => {
    render(<ParserBadge parser="gemini" />);
    expect(screen.getByText("Gemini")).toBeInTheDocument();
    expect(screen.getByText("✨")).toBeInTheDocument();
  });

  it("renders Regex parser badge", () => {
    render(<ParserBadge parser="regex" />);
    expect(screen.getByText("Regex")).toBeInTheDocument();
    expect(screen.getByText("📝")).toBeInTheDocument();
  });

  it("renders dash when parser is null", () => {
    const { container } = render(<ParserBadge parser={null} />);
    expect(container.textContent).toBe("—");
  });
});
