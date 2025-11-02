import baseConfig from "@easymo/config/eslint/base";
import nodeConfig from "@easymo/config/eslint/node";
import reactConfig from "@easymo/config/eslint/react";

export default [
  ...baseConfig,
  {
    ...reactConfig[2],
    files: [
      "admin-app/**/*.{js,jsx,ts,tsx}",
      "src/**/*.{js,jsx,ts,tsx}",
      "station-app/**/*.{js,jsx,ts,tsx}",
    ],
  },
  {
    ...reactConfig[3],
    files: [
      "admin-app/**/*.{test,spec}.{js,jsx,ts,tsx}",
      "src/**/*.{test,spec}.{js,jsx,ts,tsx}",
      "station-app/**/*.{test,spec}.{js,jsx,ts,tsx}",
    ],
  },
  {
    ...nodeConfig[2],
    files: [
      "apps/api/**/*.{ts,js}",
      "scripts/**/*.{ts,js}",
      "packages/**/scripts/**/*.{ts,js}",
      "tools/**/*.{ts,js}",
    ],
  },
  {
    ...nodeConfig[3],
    files: [
      "apps/api/**/*.{test,spec}.{ts,js}",
      "tests/**/*.{ts,js}",
      "packages/**/tests/**/*.{ts,js}",
    ],
  },
];
