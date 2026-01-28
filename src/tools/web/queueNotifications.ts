import type { NotificationTarget } from "../../web/notificationService";
import { queueNotifications } from "../../web/notificationService";

export type WebQueueNotificationsInput = {
  post_id: string;
  targets: NotificationTarget[];
};

export async function webQueueNotifications(input: WebQueueNotificationsInput): Promise<string[]> {
  return queueNotifications(input.post_id, input.targets);
}
