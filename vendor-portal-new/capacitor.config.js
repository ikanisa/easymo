/** @type {import('@capacitor/cli').CapacitorConfig} */
const config = {
  appId: "rw.ibimina.staff",
  appName: "Ibimina Admin",
  webDir: "public", // Fallback directory
  server: {
    // Connect to dev server running on your Mac
    url: "http://192.168.1.80:3101",
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
};

module.exports = config;
