import { getMemberHomeData } from "@/lib/member/data";
import { PayComposer } from "@/components/member/pay/pay-composer";

export default async function MemberPayPage() {
  const { groups } = await getMemberHomeData();

  return (
    <div className="space-y-6 text-neutral-0">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Pay via USSD</h1>
        <p className="text-sm text-white/70">
          Copy the merchant details, launch USSD, and confirm once your payment is complete.
        </p>
      </header>
      <PayComposer groups={groups} />
    </div>
  );
}
