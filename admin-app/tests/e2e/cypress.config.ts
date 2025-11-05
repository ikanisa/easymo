import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    specPattern: 'cypress/e2e/**/*.cy.ts',
    baseUrl: process.env.ADMIN_APP_BASE_URL || 'http://localhost:5173',
    supportFile: false,
  },
});
