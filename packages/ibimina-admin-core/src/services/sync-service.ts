// Placeholder for sync service
// Will be implemented in future phases

export class SyncService {
  // TODO: Implement sync service methods
  async sync(): Promise<void> {
    throw new Error('Not implemented');
  }

  async getLastSyncTime(): Promise<Date | null> {
    return null;
  }

  async clearCache(): Promise<void> {
    throw new Error('Not implemented');
  }
}
