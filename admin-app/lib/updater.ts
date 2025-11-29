import { relaunch } from '@tauri-apps/plugin-process';
import { check } from '@tauri-apps/plugin-updater';

export interface UpdateInfo {
  version: string;
  date: string;
  body?: string;
}

export interface UpdateProgress {
  event: 'Started' | 'Progress' | 'Finished';
  data?: {
    contentLength?: number;
    chunkLength?: number;
    downloaded?: number;
    total?: number;
  };
}

export type UpdateProgressCallback = (progress: UpdateProgress) => void;

/**
 * Check for application updates
 * @returns Update info if available, null if up to date
 */
export async function checkForUpdates(): Promise<UpdateInfo | null> {
  try {
    const update = await check();
    
    if (update?.available) {
      console.log(`[Updater] Found update ${update.version} from ${update.date}`);
      return {
        version: update.version,
        date: update.date,
        body: update.body,
      };
    } else {
      console.log('[Updater] No updates found - app is up to date');
      return null;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Updater] Failed to check for updates:', errorMessage);
    throw new Error(`Update check failed: ${errorMessage}`);
  }
}

/**
 * Download and install an update
 * @param onProgress - Callback for download progress updates
 */
export async function downloadAndInstallUpdate(
  onProgress?: UpdateProgressCallback
): Promise<void> {
  try {
    const update = await check();
    
    if (!update?.available) {
      throw new Error('No update available');
    }

    let downloaded = 0;
    let contentLength = 0;

    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case 'Started':
          contentLength = event.data?.contentLength || 0;
          console.log(`[Updater] Started downloading ${contentLength} bytes`);
          if (onProgress) {
            onProgress({
              event: 'Started',
              data: { contentLength, downloaded: 0, total: contentLength },
            });
          }
          break;

        case 'Progress':
          downloaded += event.data?.chunkLength || 0;
          const percent = contentLength > 0 ? (downloaded / contentLength) * 100 : 0;
          console.log(`[Updater] Downloaded ${downloaded} of ${contentLength} (${percent.toFixed(1)}%)`);
          if (onProgress) {
            onProgress({
              event: 'Progress',
              data: { downloaded, total: contentLength },
            });
          }
          break;

        case 'Finished':
          console.log('[Updater] Download finished, installing...');
          if (onProgress) {
            onProgress({
              event: 'Finished',
              data: { downloaded: contentLength, total: contentLength },
            });
          }
          break;
      }
    });

    console.log('[Updater] Update installed successfully, relaunching app...');
    
    // Give user a moment to see completion before relaunch
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Relaunch the application
    await relaunch();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Updater] Failed to download/install update:', errorMessage);
    throw new Error(`Update installation failed: ${errorMessage}`);
  }
}

/**
 * Get current app version
 */
export async function getCurrentVersion(): Promise<string> {
  try {
    const { getVersion } = await import('@tauri-apps/api/app');
    return await getVersion();
  } catch (error) {
    console.error('[Updater] Failed to get version:', error);
    return 'unknown';
  }
}
