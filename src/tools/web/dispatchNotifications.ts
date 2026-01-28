import { dispatchQueuedNotifications } from "../../web/notificationDispatcher";

export type WebDispatchNotificationsInput = {
  limit?: number;
};

export async function webDispatchNotifications(input: WebDispatchNotificationsInput) {
  return dispatchQueuedNotifications(input.limit ?? undefined);
}
