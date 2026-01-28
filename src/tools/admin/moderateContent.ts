import { recordModerationEvent, type RecordModerationEventInput } from "../../web/moderationService";

export type AdminModerateContentInput = RecordModerationEventInput;

export async function adminModerateContent(input: AdminModerateContentInput): Promise<void> {
    return recordModerationEvent(input);
}
