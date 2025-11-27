import { check } from '@tauri-apps/plugin-updater';
// import { relaunch } from '@tauri-apps/plugin-process'; // Will uncomment after npm install succeeds

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
      // await relaunch(); // Will uncomment after plugin-process is installed
    } else {
        console.log('No updates found');
    }
  } catch (error) {
    console.error('Failed to check for updates:', error);
  }
}
