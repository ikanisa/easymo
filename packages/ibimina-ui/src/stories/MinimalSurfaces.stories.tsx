import { GlassCard } from "../components/glass-card";
import { Card, CardContent, CardHeader } from "../components/card";
import { MetricCard } from "../components/metric-card";
import { VirtualTable, type VirtualTableProps } from "../components/virtual-table";
import { FormField, FormLayout, FormSummaryBanner } from "../components/form";
import { Input } from "../components/input";
import { gradients } from "../theme";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StoryMeta<T = any> = {
  title: string;
  component?: T;
  tags?: string[];
  parameters?: Record<string, unknown>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type StoryObj<T = any> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args?: Partial<any>;
  parameters?: Record<string, unknown>;
  render?: () => React.JSX.Element;
};

type MinimalRow = { name: string; status: string; amount: string };

const tableColumns: VirtualTableProps<MinimalRow>["columns"] = [
  {
    key: "name",
    header: "Name",
    minWidth: 160,
    render: (item) => (
      <span className="font-medium text-neutral-900 dark:text-neutral-50">{item.name}</span>
    ),
  },
  {
    key: "status",
    header: "Status",
    minWidth: 120,
    render: (item) => (
      <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700">
        {item.status}
      </span>
    ),
  },
  {
    key: "amount",
    header: "Amount",
    minWidth: 120,
    align: "right",
    render: (item) => <span className="text-neutral-800 dark:text-neutral-100">{item.amount}</span>,
  },
];

const tableData: MinimalRow[] = [
  { name: "Ineza N.", status: "Active", amount: "RWF 320,000" },
  { name: "Akira Bank", status: "Pending", amount: "RWF 112,400" },
  { name: "Kigali Foods", status: "Active", amount: "RWF 980,050" },
  { name: "Nyota Partners", status: "Review", amount: "RWF 240,600" },
];

const meta: StoryMeta = {
  title: "Foundations/Minimal Surfaces",
  tags: ["layout", "a11y"],
  parameters: {
    docs: {
      description: {
        component:
          "Soft glass backdrops, neutral typography, and 8pt spacing keep data-heavy layouts calm while preserving hierarchy.",
      },
    },
    chromatic: { modes: ["light", "dark"] },
  },
};

export default meta;

export const CardStack: StoryObj = {
  render: () => (
    <div className="space-y-6">
      <GlassCard
        title="Glass surface"
        subtitle="Neutral glass card with minimal chrome and comfortable spacing."
        actions={<button className="text-sm font-medium text-sky-700">Secondary</button>}
      >
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard label="Monthly inflows" value="RWF 8.6M" accent="blue" />
          <MetricCard label="Active accounts" value="1,209" accent="green" />
          <MetricCard label="Avg. ticket" value="RWF 172k" accent="neutral" />
        </div>
      </GlassCard>

      <Card
        variant="elevated"
        style={{ backgroundImage: gradients.slateSheen }}
        className="border-neutral-200/80 bg-white/70 backdrop-blur-md dark:border-neutral-700/70 dark:bg-neutral-900/70"
      >
        <CardHeader
          title="Quiet banner"
          description="Use subdued gradients and a single action to frame announcements."
          action={<button className="text-sm font-medium text-sky-700">Action</button>}
        />
        <CardContent className="text-neutral-700 dark:text-neutral-200">
          Keep copy short and legible; the surface does the visual lifting.
        </CardContent>
      </Card>
    </div>
  ),
};

export const DataTableMinimal: StoryObj = {
  render: () => (
    <div className="space-y-4">
      <FormSummaryBanner
        title="Accounts overview"
        description="Tables inherit the same glass treatment and a clear header contrast."
        status="info"
      />
      <VirtualTable
        data={tableData}
        columns={tableColumns}
        getRowKey={(item, index) => `${item.name}-${index}`}
        estimatedHeight={280}
      />
    </div>
  ),
};

export const FormHierarchy: StoryObj = {
  render: () => (
    <div className="space-y-4">
      <FormSummaryBanner
        title="Complete the onboarding form"
        description="Short helper text sits directly beneath each title for clarity."
        status="success"
      />
      <FormLayout>
        <FormField
          label="Business name"
          description="Use the registered entity name on your documentation."
          inputId="business"
          required
        >
          <Input id="business" placeholder="Kigali Farmers Cooperative" />
        </FormField>
        <FormField label="Contact email" inputId="email" optionalLabel="Optional">
          <Input id="email" type="email" placeholder="hello@company.rw" />
        </FormField>
      </FormLayout>
    </div>
  ),
};

export const Banners: StoryObj = {
  render: () => (
    <div className="space-y-3">
      <FormSummaryBanner
        title="Heads up"
        description="Payments will settle after verification."
        status="warning"
      />
      <FormSummaryBanner title="Success" description="All records are synced." status="success" />
      <FormSummaryBanner
        title="Need attention"
        description="Update business ID to proceed."
        status="error"
      />
    </div>
  ),
};
