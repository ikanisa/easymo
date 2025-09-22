interface TopBarProps {
  environmentLabel: string;
}

const alertsSummary = {
  webhook: 0,
  ocr: 0
};

export function TopBar({ environmentLabel }: TopBarProps) {
  return (
    <header
      role="banner"
      className="topbar"
      aria-label="Admin panel top bar"
    >
      <div className="topbar__env" aria-live="polite">
        <span className="topbar__env-label">Environment</span>
        <span className="topbar__env-value">{environmentLabel}</span>
      </div>
      <div className="topbar__search">
        <label className="visually-hidden" htmlFor="global-search">
          Global search
        </label>
        <input
          id="global-search"
          type="search"
          placeholder="Search orders, customers, menus…"
          aria-label="Global search"
        />
      </div>
      <div className="topbar__actions">
        <button type="button" className="topbar__alerts" aria-label="View alerts">
          Alerts
          <span className="topbar__badge" aria-hidden="true">
            {alertsSummary.webhook + alertsSummary.ocr}
          </span>
        </button>
        <button type="button" className="topbar__profile" aria-label="Open profile menu">
          <span className="topbar__avatar" aria-hidden="true">
            OP
          </span>
          <span className="topbar__profile-text">Operations</span>
        </button>
      </div>
    </header>
  );
}
