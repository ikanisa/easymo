// Placeholder for offline sync hook
// Will be implemented in future phases

export function useOffline() {
  // TODO: Implement offline sync hook
  return {
    isOnline: true,
    isSyncing: false,
    lastSyncTime: null,
    sync: async () => {},
  };
}
