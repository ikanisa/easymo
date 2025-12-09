import { OnboardingFlow } from "@/components/member/onboarding/onboarding-flow";

export default function OnboardPage() {
  return (
    <div className="space-y-6 text-neutral-0">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-white/70">Welcome</p>
        <h1 className="text-3xl font-semibold">Create your member profile</h1>
        <p className="text-base text-white/80">
          Add your contact numbers, upload your ID, and sync your memberships in a few steps.
        </p>
      </header>
      <OnboardingFlow />
    </div>
  );
}
