# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/8a9cef98-9082-4ef0-b978-fe23200a4c8a

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/8a9cef98-9082-4ef0-b978-fe23200a4c8a) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/8a9cef98-9082-4ef0-b978-fe23200a4c8a) and click on Share -> Publish.

## WhatsApp Admin Approval (Phase-1 Simulator)

### Commands

- `SUB APPROVE <id> [txn_id]` - Approve a subscription with optional transaction ID
- `SUB REJECT <id> [reason]` - Reject a subscription with optional reason  
- `SUB LIST PENDING` - List all pending subscription IDs

### Usage

1. Use `/admin/wa-console` to simulate inbound admin WhatsApp messages (dev mode only)
2. Configure admin numbers in Settings → Admin WhatsApp Numbers
3. Copy commands from Subscriptions row buttons to send via WhatsApp operationally

### Phase-2 Integration

In Phase-2, the backend will:
- Parse real WhatsApp messages using the same command grammar
- Enforce admin phone whitelist from settings
- Update database and reply to admin with success/failure
- Use webhook at `/functions/v1/wa-webhook`

## Environment Variables

- `VITE_USE_MOCK=1` - Use mock data (Phase-1 default)
- `VITE_DEV_TOOLS=1` - Enable developer tools (WA Console, Reset Data)
- `VITE_ADMIN_TOKEN` - Admin authentication token (future use)

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
