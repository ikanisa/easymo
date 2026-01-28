export type NotificationItem = {
  id: string;
  channel: string;
  target_type: string;
  status: string;
  payload: { message?: string };
  created_at: string;
  delivered_at?: string | null;
  error_message?: string | null;
};

type NotificationsListProps = {
  notifications: NotificationItem[];
};

export function NotificationsList({ notifications }: NotificationsListProps) {
  if (!notifications.length) {
    return <p className="text-muted">Awaiting notifications from the Moltbot brain.</p>;
  }

  return (
    <ul className="notification-list">
      {notifications.map((notification) => (
        <li key={notification.id}>
          <div>
            <strong>{notification.channel.toUpperCase()}</strong>
            <span>{notification.target_type}</span>
          </div>
          <p>{notification.payload.message ?? "Queued for delivery"}</p>
          <small>
            Status: {notification.status}
            {notification.delivered_at ? ` • Sent ${new Date(notification.delivered_at).toLocaleTimeString()}` : " • Awaiting dispatch"}
          </small>
          {notification.status === "failed" && notification.error_message && (
            <small className="text-muted">Error: {notification.error_message}</small>
          )}
        </li>
      ))}
    </ul>
  );
}
