import { fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("@/components/ui/page-header", () => ({
  PageHeader: ({ title, description, metadata }: any) => (
    <header>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
      {metadata}
    </header>
  ),
}));

vi.mock("@/components/ui/form", () => ({
  FormLayout: ({ children }: any) => <div>{children}</div>,
  FormField: ({ children, label, error }: any) => {
    const id = String(label).replace(/\s+/g, "-").toLowerCase();
    const describedBy = error ? `${id}-error` : undefined;
    return (
      <label>
        <span>{label}</span>
        {children({ id, describedBy })}
        {error ? <span role="alert">{error}</span> : null}
      </label>
    );
  },
  FormSummaryBanner: ({ title, description }: any) => (
    <div>
      {title ? <strong>{title}</strong> : null}
      {description ? <span>{description}</span> : null}
    </div>
  ),
}));

vi.mock("@/components/ui/stepper", () => ({
  Stepper: ({ steps, currentStep }: any) => (
    <div data-testid="stepper">{steps?.[currentStep]?.title}</div>
  ),
}));

const enqueueOnboardingSubmission = vi.fn();
const getOnboardingQueueStats = vi.fn();

vi.mock("@/lib/offline/onboarding-queue", () => ({
  enqueueOnboardingSubmission: (...args: unknown[]) => enqueueOnboardingSubmission(...args),
  getOnboardingQueueStats: (...args: unknown[]) => getOnboardingQueueStats(...args),
}));

const requestBackgroundSync = vi.fn();

vi.mock("@/lib/offline/sync", () => ({
  requestBackgroundSync: (...args: unknown[]) => requestBackgroundSync(...args),
}));

import { OnboardingFlow } from "@/components/member/onboarding/onboarding-flow";

const defaultStats = { total: 0, pending: 0, syncing: 0, failed: 0 };

function setNavigatorOnlineState(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    get: () => value,
  });
}

describe("OnboardingFlow", () => {
  const fetchMock = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>();

  beforeEach(() => {
    vi.clearAllMocks();
    setNavigatorOnlineState(true);
    getOnboardingQueueStats.mockResolvedValue(defaultStats);
    enqueueOnboardingSubmission.mockResolvedValue({ id: "queued" });
    requestBackgroundSync.mockResolvedValue(true);
    fetchMock.mockReset();
    // @ts-expect-error - override global fetch for tests
    global.fetch = fetchMock;
  });

  it("submits immediately when online", async () => {
    const user = userEvent.setup();

    fetchMock.mockImplementation((input) => {
      if (typeof input === "string" && input.includes("/api/member/ocr/upload")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ocr: {
                name: "Test User",
                idNumber: "123",
                dob: "1990-01-01",
                sex: "F",
                address: "Kigali",
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      }
      if (typeof input === "string" && input.includes("/api/member/onboard")) {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      }
      throw new Error(`Unexpected fetch call: ${input}`);
    });

    const { container } = render(<OnboardingFlow />);

    await waitFor(() => {
      expect(getOnboardingQueueStats).toHaveBeenCalled();
    });

    await user.type(screen.getByLabelText("WhatsApp number"), "+250788123456");
    await user.type(screen.getByLabelText("MoMo number"), "+250788654321");

    await user.click(screen.getByRole("button", { name: /next/i }));

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["file"], "id.png", { type: "image/png" });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    await screen.findByText("Identity document processed");

    await user.click(screen.getByRole("button", { name: /next/i }));

    await user.click(screen.getByRole("button", { name: /finish onboarding/i }));

    await screen.findByText("Member onboarded");

    expect(enqueueOnboardingSubmission).not.toHaveBeenCalled();
    expect(requestBackgroundSync).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/member/onboard",
      expect.objectContaining({ method: "POST" })
    );
    expect(pushMock).toHaveBeenCalledWith("/member");
    expect(screen.getByText("Offline submissions are queued automatically.")).toBeInTheDocument();
  });

  it("queues submission when offline", async () => {
    const user = userEvent.setup();
    setNavigatorOnlineState(false);

    getOnboardingQueueStats
      .mockResolvedValueOnce(defaultStats)
      .mockResolvedValueOnce({ total: 1, pending: 1, syncing: 0, failed: 0 })
      .mockResolvedValue({ total: 1, pending: 1, syncing: 0, failed: 0 });

    fetchMock.mockImplementation((input) => {
      if (typeof input === "string" && input.includes("/api/member/ocr/upload")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ocr: {
                name: "Queued User",
                idNumber: "987",
                dob: "1985-05-05",
                sex: "M",
                address: "Huye",
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      }
      if (typeof input === "string" && input.includes("/api/member/onboard")) {
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      }
      throw new Error(`Unexpected fetch call: ${input}`);
    });

    const { container } = render(<OnboardingFlow />);

    await waitFor(() => {
      expect(getOnboardingQueueStats).toHaveBeenCalled();
    });

    await user.type(screen.getByLabelText("WhatsApp number"), "+250788123456");
    await user.type(screen.getByLabelText("MoMo number"), "+250788654321");

    await user.click(screen.getByRole("button", { name: /next/i }));

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["file"], "id.png", { type: "image/png" });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    await screen.findByText("Identity document processed");

    await user.click(screen.getByRole("button", { name: /next/i }));

    await user.click(screen.getByRole("button", { name: /finish onboarding/i }));

    await waitFor(() => {
      expect(enqueueOnboardingSubmission).toHaveBeenCalledWith(
        expect.objectContaining({
          whatsapp_msisdn: "+250788123456",
          momo_msisdn: "+250788654321",
        })
      );
    });

    expect(requestBackgroundSync).toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();

    await screen.findByText("Submission queued for sync");
    expect(
      screen.getByText("We'll sync automatically once you're back online.")
    ).toBeInTheDocument();
    expect(screen.getByText(/1 offline submission awaiting sync/i)).toBeInTheDocument();

    // Only the OCR upload should have been sent while offline
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
