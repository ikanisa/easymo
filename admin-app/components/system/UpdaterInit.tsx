'use client';

import { useEffect, useState } from 'react';
import { checkForUpdates, downloadAndInstallUpdate, type UpdateInfo } from '@/lib/updater';

export function UpdaterInit() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only check for updates in Tauri desktop context
    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      performUpdateCheck();
      
      // Check every 6 hours
      const interval = setInterval(performUpdateCheck, 6 * 60 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, []);

  async function performUpdateCheck() {
    try {
      const update = await checkForUpdates();
      if (update) {
        setUpdateInfo(update);
        console.log(`[UpdaterInit] Update available: ${update.version}`);
      }
    } catch (err) {
      console.error('[UpdaterInit] Update check failed:', err);
      // Don't show error to user for background checks
    }
  }

  async function handleInstall() {
    if (!updateInfo) return;

    setDownloading(true);
    setError(null);
    setProgress(0);

    try {
      await downloadAndInstallUpdate((progressEvent) => {
        if (progressEvent.event === 'Progress' && progressEvent.data) {
          const percent = progressEvent.data.total 
            ? (progressEvent.data.downloaded / progressEvent.data.total) * 100
            : 0;
          setProgress(percent);
        } else if (progressEvent.event === 'Finished') {
          setProgress(100);
        }
      });
      
      // App will relaunch, this code won't execute
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      setDownloading(false);
      setProgress(0);
    }
  }

  function handleDismiss() {
    setUpdateInfo(null);
    setError(null);
  }

  if (!updateInfo) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-blue-600 text-white p-4 rounded-lg shadow-2xl max-w-sm border-2 border-blue-400 animate-in slide-in-from-bottom-5">
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-lg">Update Available</h3>
        {!downloading && (
          <button
            onClick={handleDismiss}
            className="text-white hover:text-gray-200 transition-colors"
            aria-label="Dismiss update notification"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <p className="text-sm mb-3">
        Version <strong>{updateInfo.version}</strong> is ready to install
      </p>

      {updateInfo.body && (
        <p className="text-xs mb-3 opacity-90 line-clamp-2">
          {updateInfo.body}
        </p>
      )}

      {error && (
        <div className="mb-3 p-2 bg-red-500 bg-opacity-20 border border-red-400 rounded text-xs">
          <p className="font-semibold">Installation Error:</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {downloading ? (
        <div>
          <div className="w-full bg-blue-800 rounded-full h-2 mb-2 overflow-hidden">
            <div
              className="bg-white h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-center">
            {progress < 100
              ? `Downloading... ${progress.toFixed(0)}%`
              : 'Installing... App will relaunch'}
          </p>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={handleInstall}
            disabled={downloading}
            className="flex-1 px-4 py-2 bg-white text-blue-600 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            Install Now
          </button>
          <button
            onClick={handleDismiss}
            className="px-4 py-2 border border-white rounded hover:bg-blue-700 transition-colors text-sm"
          >
            Later
          </button>
        </div>
      )}
    </div>
  );
}
