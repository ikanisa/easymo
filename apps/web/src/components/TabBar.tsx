import clsx from "clsx";

export type TabKey = "chat" | "vendors" | "listings" | "requests";

type TabBarProps = {
  active: TabKey;
  onChange: (tab: TabKey) => void;
  disabled?: boolean;
};

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "chat", label: "Chat" },
  { key: "vendors", label: "Vendors" },
  { key: "listings", label: "Listings" },
  { key: "requests", label: "Requests" },
];

export function TabBar({ active, onChange, disabled = false }: TabBarProps) {
  return (
    <nav className="tab-bar" aria-label="Marketplace navigation">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={clsx("tab-button", { "tab-button-active": active === tab.key })}
          onClick={() => onChange(tab.key)}
          disabled={disabled}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

