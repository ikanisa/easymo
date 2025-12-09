import { AppShellHero } from "@/components/layout/app-shell";
import {
  WorkspaceAside,
  WorkspaceLayout,
  WorkspaceMain,
} from "@/components/layout/workspace-layout";
import { GradientHeader } from "@/components/ui/gradient-header";
import { GlassCard } from "@/components/ui/glass-card";
import { requireUserAndProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Trans } from "@/components/common/trans";
import { MomoInboxTable } from "./components/MomoInboxTable";
import { MomoInboxStats } from "./components/MomoInboxStats";
import type { MomoSmsInbox } from "./types";

type MomoSmsRow = MomoSmsInbox;

const GUEST_MODE = process.env.AUTH_GUEST_MODE === "1";

const GUEST_SMS: MomoSmsRow[] = [
  {
    id: "demo-1",
    phone_number: "+233XXXXXXXXX",
    sender: "MTN MoMo",
    raw_message: "You have received 5,000.00 GHS from JOHN DOE. Transaction ID: 123456789. Your new balance is 10,000.00 GHS",
    parsed_amount: 5000.00,
    parsed_sender_name: "JOHN DOE",
    parsed_transaction_id: "123456789",
    parsed_provider: "mtn",
    received_at: new Date(Date.now() - 3600000).toISOString(),
    processed: true,
    matched_payment_id: "payment-1",
    match_confidence: 0.80,
    signature: "demo-signature",
    device_id: "demo-device",
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "demo-2",
    phone_number: "+233XXXXXXXXX",
    sender: "Vodafone Cash",
    raw_message: "You have received GHS 3,500.00 from JANE SMITH. Ref: VC987654321. Available balance: 6,500.00 GHS",
    parsed_amount: 3500.00,
    parsed_sender_name: "JANE SMITH",
    parsed_transaction_id: "VC987654321",
    parsed_provider: "vodafone",
    received_at: new Date(Date.now() - 7200000).toISOString(),
    processed: false,
    matched_payment_id: null,
    match_confidence: null,
    signature: "demo-signature-2",
    device_id: "demo-device",
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
];

export default async function MomoInboxPage() {
  let smsMessages: MomoSmsRow[] = [];
  let totalReceived = 0;
  let matchedCount = 0;
  let pendingCount = 0;

  if (GUEST_MODE) {
    smsMessages = GUEST_SMS;
    totalReceived = GUEST_SMS.length;
    matchedCount = GUEST_SMS.filter(s => s.processed).length;
    pendingCount = GUEST_SMS.filter(s => !s.processed).length;
  } else {
    const { profile } = await requireUserAndProfile();
    const supabase = await createSupabaseServerClient();

    // Fetch SMS messages
    const { data, error } = await supabase
      .from("momo_sms_inbox")
      .select("*")
      .order("received_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Failed to fetch MoMo SMS:", error);
      smsMessages = [];
    } else {
      smsMessages = data || [];
    }

    // Calculate stats
    totalReceived = smsMessages.length;
    matchedCount = smsMessages.filter(s => s.processed).length;
    pendingCount = smsMessages.filter(s => !s.processed).length;
  }

  return (
    <>
      <AppShellHero>
        <GradientHeader
          title={<Trans k="momoInbox.title" defaultText="Mobile Money SMS Inbox" />}
          description={
            <Trans
              k="momoInbox.description"
              defaultText="Review and manage incoming Mobile Money payment notifications"
            />
          }
        />
      </AppShellHero>

      <WorkspaceLayout>
        <WorkspaceMain>
          {/* Stats Section */}
          <MomoInboxStats
            totalReceived={totalReceived}
            matchedCount={matchedCount}
            pendingCount={pendingCount}
          />

          {/* SMS Table */}
          <GlassCard className="mt-6">
            <MomoInboxTable messages={smsMessages} />
          </GlassCard>
        </WorkspaceMain>

        <WorkspaceAside>
          <GlassCard>
            <h3 className="text-lg font-medium mb-4">
              <Trans k="momoInbox.help.title" defaultText="About SMS Inbox" />
            </h3>
            <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
              <p>
                <Trans
                  k="momoInbox.help.description"
                  defaultText="This inbox receives Mobile Money payment notifications relayed from your Android devices running MomoTerminal."
                />
              </p>
              <p>
                <Trans
                  k="momoInbox.help.autoMatch"
                  defaultText="SMS messages are automatically matched to pending payments based on amount and timing."
                />
              </p>
              <p>
                <Trans
                  k="momoInbox.help.manual"
                  defaultText="Unmatched messages can be manually reviewed and matched to contributions."
                />
              </p>
            </div>
          </GlassCard>

          <GlassCard className="mt-4">
            <h3 className="text-lg font-medium mb-4">
              <Trans k="momoInbox.providers.title" defaultText="Supported Providers" />
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                <span>MTN MoMo</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <span>Vodafone Cash</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span>AirtelTigo Money</span>
              </div>
            </div>
          </GlassCard>
        </WorkspaceAside>
      </WorkspaceLayout>
    </>
  );
}
