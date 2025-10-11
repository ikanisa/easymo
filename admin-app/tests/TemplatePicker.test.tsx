import { render, screen, fireEvent } from "./utils/react-testing";
import { describe, expect, it, vi } from "vitest";
import { TemplatePicker } from "@/components/templates/TemplatePicker";
import type { TemplateMeta } from "@/lib/schemas";

const templates: TemplateMeta[] = [
  {
    id: "t1",
    name: "Promo",
    purpose: "Promotion",
    locales: ["en"],
    status: "approved",
    variables: ["code"],
    lastUsedAt: null,
    errorRate: 0,
  },
  {
    id: "t2",
    name: "Reminder",
    purpose: "Reminder",
    locales: ["en", "rw"],
    status: "draft",
    variables: [],
    lastUsedAt: null,
    errorRate: 0,
  },
];

describe("TemplatePicker", () => {
  it("renders options and handles selection", () => {
    const handleChange = vi.fn();
    render(<TemplatePicker templates={templates} onChange={handleChange} />);

    const buttons = screen.getAllByRole("option");
    expect(buttons).toHaveLength(2);

    fireEvent.click(buttons[1]);
    expect(handleChange).toHaveBeenCalledWith("t2");
    expect(buttons[1]).toHaveAttribute("aria-selected", "true");
  });

  it("respects initial value", () => {
    render(<TemplatePicker templates={templates} value="t1" />);
    expect(screen.getAllByRole("option")[0]).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
