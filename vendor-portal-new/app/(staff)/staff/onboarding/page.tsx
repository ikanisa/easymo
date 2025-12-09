import { OnboardingFlow } from "@/components/member/onboarding/onboarding-flow";

export default function StaffOnboardingPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-semibold text-neutral-0">Member onboarding</h2>
        <p className="text-sm text-neutral-200/70">
          Capture contact numbers and identity documents for new ibimina members.
        </p>
      </header>
      <div className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-inner">
        <OnboardingFlow />
      </div>
    </div>
  );
}
