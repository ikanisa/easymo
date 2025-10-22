# Main Branch Migration Notes

This repository now tracks the long-lived `work` branch from the new `main` branch locally. The steps to complete the migration when repository permissions are available are:

1. Push the local `main` branch to the remote:
   ```bash
   git push -u origin main
   ```
2. Update the repository's default branch in the hosting provider (for example, GitHub) to `main`.
3. Update the Vercel project settings to deploy from the `main` branch and trigger a new deployment.

Local history already contains the latest `work` changes on `main`, so no further merge work is required after the remote defaults are updated.
