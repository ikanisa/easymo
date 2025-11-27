import { check } from '@tauri-apps/plugin-updater';
// import { relaunch } from '@tauri-apps/plugin-process';

export async function checkForUpdates() {
  try {
    const update = await check();
    if (update) {
      console.log(`Found update ${update.version} from ${update.date}`);
      let downloaded = 0;
      let contentLength = 0;
      
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength || 0;
            console.log(`Started downloading ${contentLength} bytes`);
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            console.log(`Downloaded ${downloaded} of ${contentLength}`);
            break;
          case 'Finished':
            console.log('Download finished');
            break;
        }
      });

      console.log('Update installed, relaunching...');
      // await relaunch(); // Temporarily disabled due to missing module
    } else {
        console.log('No updates found');
    }
  } catch (error) {
    console.error('Failed to check for updates:', error);
  }
}
