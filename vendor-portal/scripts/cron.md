# Scheduled Task Guidance

This project previously relied on GitHub Actions cron triggers. Those schedules
have been removed while we refine the automation approach. Several checks that
used to run via ad-hoc cron jobs—such as the PWA baseline verification—are now
executed automatically in the main CI pipeline to remove manual overhead.

## Running scheduled work locally

Use the following options to simulate scheduled jobs until automation returns:

1. **System cron**
   - Register a cron entry that executes the required pnpm script.
   - Example:
     ```cron
     */30 * * * * cd /path/to/repo && pnpm run task-name
     ```
   - Ensure the environment variables required by the script are exported in the
     cron context.

2. **node-cron script**
   - Install `node-cron` as a dev dependency if it is not already available:
     ```bash
     pnpm add -D node-cron
     ```
   - Create a small runner, e.g. `scripts/schedule-runner.mjs`:

     ```js
     import cron from "node-cron";
     import { runTask } from "./task-runner.mjs";

     cron.schedule("0 2 * * *", async () => {
       await runTask();
     });
     ```

   - Launch it locally with `pnpm node scripts/schedule-runner.mjs`.

## Next steps

- [ ] TODO: Reintroduce automated scheduling once the revised workflow
      requirements are defined.
