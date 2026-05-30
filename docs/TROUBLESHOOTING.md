# 🐛 Troubleshooting Guide

## Quick Fixes

| Issue | Solution |
|-------|----------|
| **Can't login** | Check `.env.local` has `NEXTAUTH_SECRET`. Try incognito mode. Clear cookies. |
| **Port in use** | `lsof -ti:3000 \| xargs kill -9` or use `npm run dev -- -p 3002` |
| **Build fails** | `rm -rf .next && npm install && npm run build` |
| **Database locked** | `pm2 restart rhcsolutions` |
| **API not responding** | Check PM2 status: `pm2 logs rhcsolutions` |
| **Missing pages/content** | Restore from backup (see Backup & Recovery guide) |

---

## Build & Compilation

### "Build Fails with Module Errors"

**Error**:
```
Error: Could not find module at path...
Module not found...
```

**Solution**:
```bash
# 1. Clear cache
rm -rf .next
rm -rf node_modules/.cache

# 2. Reinstall
npm install

# 3. Rebuild
npm run build

# 4. Restart
pm2 restart rhcsolutions
```

### "TypeScript Errors During Build"

**Error**:
```
Type 'X' is not assignable to type 'Y'
...
```

**Solution**:
```bash
# Check strict mode
npx tsc --noEmit

# Fix type issues in source
# Then rebuild
npm run build
```

### "Cannot Find Module '@/' or Other Path Aliases"

**Error**:
```
Module not found: Can't resolve '@/components/...'
```

**Solution**:
```bash
# Verify tsconfig.json has paths configured
cat tsconfig.json | grep -A 5 '"paths"'

# Should have @/* mapped to ./src/*

# Rebuild with clean cache
rm -rf .next
npm run build
```

---

## Authentication Issues

### "Cannot Login" / "Invalid Email or Password"

**Cause**: Wrong credentials or database issue

**Solution**:
```bash
# 1. Check default credentials changed
# admin@rhcsolutions.com / admin123

# 2. Verify NEXTAUTH_SECRET in .env.local
grep NEXTAUTH_SECRET .env.local

# 3. If blank or missing, generate new
openssl rand -base64 32

# 4. Add to .env.local
echo "NEXTAUTH_SECRET=<new-secret>" >> .env.local

# 5. Restart
pm2 restart rhcsolutions

# 6. Clear browser cookies and try again
```

### "Session Expired" / "Not Authenticated"

**Cause**: NEXTAUTH_SECRET changed or session invalid

**Solution**:
```bash
# 1. Verify NEXTAUTH_SECRET matches
grep NEXTAUTH_SECRET .env.local

# 2. Clear browser cookies
# Settings → Privacy → Clear browsing data

# 3. Try incognito/private window

# 4. If still failing, restart server
pm2 restart rhcsolutions

# 5. Try login again
```

### "2FA Code Not Accepted"

**Cause**: Time sync issue or wrong app

**Solution**:
```bash
# 1. Verify time is correct on server
date

# 2. Ensure authenticator app is synchronized
# Google Authenticator, Authy, etc.

# 3. Try code within 30-second window

# 4. Use recovery codes if available

# 5. If locked out, reset 2FA in database
sqlite3 cms-data/cms.db "UPDATE users SET twoFactorEnabled = 0;"
pm2 restart rhcsolutions
```

---

## Database Issues

### "Database Locked"

**Error**:
```
database disk image is malformed
database is locked
```

**Cause**: Concurrent access or incomplete transaction

**Solution**:
```bash
# 1. Check WAL files exist
ls -la cms.db*

# 2. Check for running processes
lsof | grep cms.db

# 3. Restart application
pm2 restart rhcsolutions

# 4. If still locked, remove WAL files (WARNING: may lose data)
rm cms.db-shm cms.db-wal

# 5. Rebuild
npm run build
pm2 restart rhcsolutions
```

### "Database Integrity Error"

**Error**:
```
PRAGMA integrity_check; returns errors
```

**Cause**: Corruption or incomplete backup

**Solution**:
```bash
# 1. Check integrity
sqlite3 cms.db "PRAGMA integrity_check;"

# 2. Try repair
sqlite3 cms.db "PRAGMA integrity_check;"

# 3. If corrupted, restore from backup
cp backup/cms-data/cms.db cms-data/cms.db

# 4. Verify restored backup
sqlite3 cms-data/cms.db "SELECT COUNT(*) FROM pages;"

# 5. Restart
pm2 restart rhcsolutions
```

### "Empty Database After Restore"

**Cause**: Database not initialized or backup corrupted

**Solution**:
```bash
# 1. Check backup contents
unzip -l backup.zip | grep cms.db

# 2. Extract and verify
unzip backup.zip -d /tmp/test
sqlite3 /tmp/test/cms-data/cms.db "SELECT COUNT(*) FROM pages;"

# 3. If backup is good, restore
cp /tmp/test/cms-data/cms.db cms-data/cms.db

# 4. If backup empty, restore from older backup
ls -lt cms-data/backups/*.zip
# Pick an older one

# 5. Restart
pm2 restart rhcsolutions
```

---

## Network & Port Issues

### "Port 3000 / 3001 Already In Use"

**Error**:
```
Error: listen EADDRINUSE :::3000
```

**Cause**: Process already running on port

**Solution**:
```bash
# 1. Find process on port
lsof -ti:3000

# 2. Kill process
lsof -ti:3000 | xargs kill -9

# 3. Or use different port
npm run dev -- -p 3002

# 4. For production
PORT=3002 npm start

# 5. Update PM2 config if needed
pm2 start ecosystem.config.js
```

### "Cannot Connect to Server"

**Cause**: Server not running or port closed

**Solution**:
```bash
# 1. Check if running
pm2 status

# 2. Check if port open
netstat -tuln | grep 3001

# 3. Check firewall
sudo ufw status
sudo ufw allow 3001

# 4. Check logs
pm2 logs rhcsolutions

# 5. Restart
pm2 restart rhcsolutions
```

### "CORS Errors" / "Cross-Origin Block"

**Error**:
```
Cross-Origin Request Blocked
Access-Control-Allow-Origin header missing
```

**Cause**: API request from different origin

**Solution**:
```bash
# 1. Check next.config.mjs for CORS settings
grep -A 5 "headers" next.config.mjs

# 2. Add CORS headers if needed
# (Already configured for admin endpoints)

# 3. For custom endpoints, add headers
res.setHeader('Access-Control-Allow-Origin', '*')

# 4. Rebuild
npm run build
pm2 restart rhcsolutions
```

---

## API & Endpoint Issues

### "API Returns 404"

**Cause**: Route doesn't exist or middleware blocked

**Solution**:
```bash
# 1. Verify route exists
grep -r "api/endpoint-name" src/app/api

# 2. Check method (GET, POST, etc.)
curl -X GET https://yourdomain.com/api/cms/pages

# 3. Check auth middleware
curl -H "Authorization: Bearer $TOKEN" https://yourdomain.com/api/admin/users

# 4. Check logs
pm2 logs rhcsolutions
```

### "API Returns 401 Unauthorized"

**Cause**: Not authenticated or token invalid

**Solution**:
```bash
# 1. Login first
curl -X POST https://yourdomain.com/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@rhcsolutions.com","password":"..."}'

# 2. Use returned session

# 3. Or verify session exists
curl https://yourdomain.com/api/auth/session

# 4. If no session, login first
```

### "API Returns 500 Internal Server Error"

**Cause**: Server-side error in API route

**Solution**:
```bash
# 1. Check logs for errors
pm2 logs rhcsolutions --lines 100

# 2. Look for error stack trace

# 3. Common causes:
# - Missing environment variable
# - Database query error
# - Unhandled exception

# 4. Verify env vars
grep API_KEY .env.local

# 5. Test database
sqlite3 cms.db "SELECT 1;"

# 6. Check API route code
cat src/app/api/endpoint-name/route.ts

# 7. Fix issue and restart
pm2 restart rhcsolutions
```

---

## Backup & Restore Issues

### "Backup Creation Fails"

**Error**: Backup process stops or error message

**Solution**:
```bash
# 1. Check disk space
df -h

# 2. Free up space if needed
rm -rf .next  # Safe to delete, rebuild as needed

# 3. Check file permissions
ls -la cms-data/

# 4. Try manual backup
tar -czf backup-manual.tar.gz cms-data/

# 5. Check logs
pm2 logs rhcsolutions
```

### "Restore Fails with 'npm install' Error"

**Error**: `npm ERR! 404 Not Found`

**Cause**: Network issue or corrupted package.json

**Solution**:
```bash
# 1. Verify package.json is valid
cat package.json | head

# 2. Check internet connection
ping npm.js.org

# 3. Clear npm cache
npm cache clean --force

# 4. Retry install
npm install

# 5. If specific package fails
npm install --force

# 6. Last resort: use yarn
yarn install
```

### "Restore Fails with 'Build' Error"

**Error**: Build fails after npm install

**Cause**: Missing dependencies or code errors

**Solution**:
```bash
# 1. Clear cache
rm -rf .next node_modules/.cache

# 2. Check TypeScript
npx tsc --noEmit

# 3. Fix any errors

# 4. Try rebuild
npm run build

# 5. If still failing, check Node version
node --version  # Should be 18+

# 6. Update Node if needed
nvm install 18
nvm use 18
```

---

## Admin Panel Issues

### "Admin Dashboard Shows 'Application Error'"

**Cause**: Frontend error or API unreachable

**Solution**:
```bash
# 1. Check browser console for error
# Open DevTools (F12) → Console

# 2. Check server logs
pm2 logs rhcsolutions

# 3. Verify API responding
curl https://yourdomain.com/api/cms/settings

# 4. Rebuild frontend
npm run build

# 5. Restart
pm2 restart rhcsolutions

# 6. Hard refresh browser (Ctrl+Shift+R)
```

### "Admin Pages Not Loading"

**Cause**: Route not found or permission denied

**Solution**:
```bash
# 1. Verify logged in
curl https://yourdomain.com/api/auth/session

# 2. Check user role
sqlite3 cms-data/cms.db "SELECT email, role FROM users;"

# 3. If wrong role, update
sqlite3 cms-data/cms.db "UPDATE users SET role = 'admin' WHERE email = 'admin@...';"

# 4. Restart
pm2 restart rhcsolutions

# 5. Logout and login again
```

### "Analytics/Cloudflare Data Not Loading"

**Cause**: Credentials missing or API key invalid

**Solution**:
```bash
# 1. Check credentials set
grep GA_PROPERTY_ID .env.local
grep CLOUDFLARE_API_TOKEN .env.local

# 2. Test connection from admin panel
# Go to /admin/analytics/setup or /admin/cloudflare/setup
# Click "Test Configuration"

# 3. If test fails, verify credentials valid
# GA4: https://analytics.google.com/ → Admin → Properties
# Cloudflare: https://dash.cloudflare.com/ → Profile → API Tokens

# 4. Update credentials in .env.local

# 5. Restart
pm2 restart rhcsolutions
```

---

## Email & Contact Issues

### "Contact Form Not Sending"

**Cause**: SMTP not configured or email failing

**Solution**:
```bash
# 1. Check SMTP config
grep SMTP .env.local

# 2. Verify credentials
# For Gmail: Create App Password at https://myaccount.google.com/apppasswords

# 3. Test email from admin panel
# /admin/settings → Send Test Email

# 4. Check logs for error
pm2 logs rhcsolutions | grep -i email

# 5. If Gmail, enable "Less secure app access"
# https://myaccount.google.com/lesssecureapps

# 6. Restart
pm2 restart rhcsolutions
```

### "Contact Form Shows reCAPTCHA Error"

**Cause**: reCAPTCHA key missing or invalid

**Solution**:
```bash
# 1. Check keys configured
grep RECAPTCHA .env.local

# 2. Verify at Google reCAPTCHA console
# https://www.google.com/recaptcha/admin

# 3. Test with valid keys

# 4. If using Cloudflare Turnstile instead:
grep TURNSTILE .env.local

# 5. Update .env.local and restart
pm2 restart rhcsolutions
```

---

## Performance Issues

### "Slow Page Loads"

**Cause**: CDN not active, large assets, or DB queries slow

**Solution**:
```bash
# 1. Check CDN status (Cloudflare)
# https://dash.cloudflare.com/ → Select domain

# 2. Check cache headers
curl -I https://yourdomain.com/

# 3. Test page load time
curl -w "@curl-format.txt" https://yourdomain.com/

# 4. Analyze bundle
npm run build -- --debug

# 5. Check database queries
pm2 logs rhcsolutions | grep "query"

# 6. Monitor server resources
pm2 monit
```

### "High Memory Usage"

**Cause**: Memory leak or too many connections

**Solution**:
```bash
# 1. Check memory
pm2 monit

# 2. Check process memory
ps aux | grep node

# 3. Restart to free memory
pm2 restart rhcsolutions

# 4. Monitor after restart
pm2 logs rhcsolutions

# 5. If recurring, check for memory leaks
# Review recent code changes
```

### "Google Analytics Shows No Data"

**Cause**: One of (most common first):

1. **Consent banner not accepted** — by default the site uses [Consent Mode v2](./TECHNICAL.md#google-analytics-4--consent-mode-v2): `gtag.js` loads but consent starts as `denied`. Consenting visitors fire full hits; non‑consenting visitors fire cookieless pings only.
2. **GA4 ID missing** — check `/admin/seo` → GA4 ID field is filled with a `G-XXXXXXXXXX` value, OR `NEXT_PUBLIC_GA4_ID` / `NEXT_PUBLIC_GA_ID` is set in `.env.local`.
3. **Data stream mismatch** — the GA4 property's web data stream URL must point at `rhcsolutions.com`.
4. **Ad blocker** on the test browser is silently dropping `collect` requests.

**How to diagnose**:
```bash
# In an incognito window on the live site, open DevTools console:
document.querySelector('script[src*="googletagmanager.com/gtag/js"]')
# null  → GA4 ID is missing or component not mounted

# Network tab → filter "google-analytics.com":
# - No requests at all → ad blocker or script blocked by CSP
# - Only "g/collect?…&gcs=G100" → consent denied (cookieless ping)
# - "g/collect?…&gcs=G111" → consent granted (full tracking)
```

GA Realtime updates within ~30 s; standard reports lag 24–48 h.

### "CPU Usage High"

**Cause**: Expensive operations or background jobs

**Solution**:
```bash
# 1. Monitor CPU
pm2 monit

# 2. Check logs for active operations
pm2 logs rhcsolutions

# 3. Check if backup running
ls -la cms-data/backups/  # Recent backup = high CPU

# 4. Wait for backup to complete

# 5. If issue persists, restart
pm2 restart rhcsolutions
```

---

## Common Error Messages & Fixes

```
Error: ENOENT: no such file or directory
→ Missing file/directory. Check .env.local and paths

Error: connect ECONNREFUSED 127.0.0.1:5432
→ PostgreSQL not running (if using). Use SQLite instead.

Error: 413 Payload Too Large
→ File upload too large. Check file size limits.

Error: ENOSPC: no space left on device
→ Disk full. Clean up: rm -rf .next, rm old backups

Error: rate limit exceeded
→ Too many requests to API. Wait and retry.

SyntaxError: Unexpected token
→ JSON parsing error. Check file encoding and format.

Error: certificate verify failed
→ SSL/HTTPS issue. Update certificates or check firewall.
```

---

## When to Restore from Backup

- **Site completely down** → Restore from latest backup
- **Database corrupted** → Restore from latest backup
- **Accidental content deletion** → Restore to point-in-time
- **Security breach** → Restore from clean backup
- **Major update failed** → Restore to pre-update backup

**See [Backup & Recovery Guide](./BACKUP_RECOVERY.md) for full instructions**

---

## Getting Help

1. **Check logs first**: `pm2 logs rhcsolutions`
2. **Search this guide**: Use Ctrl+F to search
3. **Check environment**: `grep VAR .env.local`
4. **Verify database**: `sqlite3 cms.db "PRAGMA integrity_check;"`
5. **Test API**: `curl https://yourdomain.com/api/cms/settings`
6. **Review code**: Check relevant file in src/

---

**Last Updated**: January 9, 2026
