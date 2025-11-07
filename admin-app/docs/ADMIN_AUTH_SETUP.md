# Admin App Environment Variables

## Required for Authentication

Set these in your Netlify environment variables (Site settings → Environment variables):

```bash
# Admin login credentials (required)
ADMIN_EMAIL=info@ikanisa.com
ADMIN_PASSWORD=your-secure-password-here

# Admin session security (required)
ADMIN_SESSION_SECRET=your-random-secret-min-32-chars

# Optional: Actor ID (defaults to UUID below if not set)
ADMIN_ACTOR_ID=00000000-0000-0000-0000-000000000001
```

## Quick Setup for Netlify

1. **Log in to Netlify Dashboard**
   - Go to: https://app.netlify.com/sites/easymo-admin/configuration/env

2. **Add Environment Variables**
   - Click "Add a variable"
   - Add each variable above with your values
   - Make sure to set them for "All scopes" (production, deploy previews, branch deploys)

3. **Generate Secure Secret**
   ```bash
   # Generate ADMIN_SESSION_SECRET
   openssl rand -hex 32
   ```

4. **Redeploy**
   - After saving variables, trigger a new deploy
   - Or wait for next push to main

## Local Development

Create `.env.local` in the admin-app directory:

```bash
ADMIN_EMAIL=info@ikanisa.com
ADMIN_PASSWORD=testpassword123
ADMIN_SESSION_SECRET=your-local-secret-key-min-32-chars
```

## Testing Login

1. Visit your deployed site or http://localhost:3000 (local)
2. Enter the email and password you configured
3. You should be redirected to `/dashboard` on success

## Security Notes

- ⚠️ **Never commit** `.env.local` or real credentials to git
- ✅ Use a strong password (min 8 characters)
- ✅ Use a random secret for `ADMIN_SESSION_SECRET` (min 32 characters)
- ✅ Session expires after 12 hours of inactivity
- ✅ Rate limiting: max 5 login attempts per minute per IP

## Troubleshooting

### "Admin authentication not configured" error
- Ensure `ADMIN_PASSWORD` is set in Netlify environment variables
- Redeploy after adding variables

### Login doesn't redirect
- Check browser console for errors
- Verify all three variables are set correctly
- Try hard refresh (Cmd+Shift+R or Ctrl+Shift+R)

### "Too many login attempts"
- Wait 1 minute and try again
- Check if you're using the correct password
