# 💾 Backup & Recovery Guide

## Quick Start

### Manual Backup
1. Go to `/admin/backups`
2. Click "Create Backup Now"
3. Download ZIP or send to Telegram

### Restore from Backup
```bash
unzip backup.zip -d restored
cd restored
npm install && npm run build && npm start
```

**⚠️ CRITICAL**: Use `.env.local` from backup (contains NEXTAUTH_SECRET)

---

## Automated Backups

- **Schedule**: Daily at 2:00 AM UTC
- **Retention**: 14 days (automatic cleanup)
- **Storage**: Local (`cms-data/backups/`) + optional Telegram
- **Contents**: Database, source code, media, configuration

### Telegram Cloud Backup

Benefits:
- Off-site storage
- Instant notifications
- Mobile access
- 50MB per backup limit

Setup:
1. Create bot with [@BotFather](https://t.me/botfather)
2. Get bot token and chat ID
3. Add to `.env.local`:
   ```bash
   TELEGRAM_BOT_TOKEN=your_token
   TELEGRAM_CHAT_ID=-123456789
   ```
4. Test from admin panel

---

## Complete Restoration Process

### Full Site Restore

⚠️ **CRITICAL**: Follow steps in order!

```bash
# Step 1: Extract backup
unzip backup-2026-01-04.zip -d /var/www/mysite
cd /var/www/mysite

# Step 2: Verify files present
ls -la
# Should see: cms-data/ src/ public/ package.json .env.local

# Step 3: Install dependencies (2-5 minutes)
npm install

# Step 4: Build application (REQUIRED - generates .next/)
npm run build

# Step 5: Start server
npm start          # Production
# OR
npm run dev        # Development
```

**One-liner restoration**:
```bash
unzip backup.zip -d restored && cd restored && npm install && npm run build && npm start
```

---

## What's in a Backup?

Each backup ZIP contains:

1. **SQLite Database** (`cms-data/cms.db`)
   - All content, users, settings, forms, submissions
   - Integrity verified before backup

2. **Source Code** (`src/` directory)
   - All pages, components, APIs

3. **Public Assets** (`public/` directory)
   - Logo, uploaded media, static files

4. **Configuration Files**
   - `.env.local` - **CRITICAL for authentication**
   - `package.json` - Dependencies list
   - Build config files

5. **Documentation**
   - `BACKUP_MANIFEST.json` - Backup metadata
   - `installed-modules.txt` - npm packages list

---

## Backup Verification

### Check Backup Contents
```bash
unzip -l backup-2026-01-04.zip
```

### Verify Database Integrity
```bash
# Before extraction, verify files
unzip backup-2026-01-04.zip -d /tmp/test

# Check database
sqlite3 /tmp/test/cms-data/cms.db "PRAGMA integrity_check;"
# Should output: ok

# Count records
sqlite3 /tmp/test/cms-data/cms.db "SELECT COUNT(*) FROM pages;"
```

### List Backups
```bash
ls -lht cms-data/backups/    # Sort by newest first
du -sh cms-data/backups/      # Total size
```

---

## Common Restoration Issues & Solutions

### ⚠️ "Could not find a production build in the '.next' directory"

**Error**: `Error: Could not find a production build in the '.next' directory`

**Why**: Ran `npm start` before `npm run build`. The `.next/` directory is not in backups (it's build output).

**Solution**:
```bash
npm run build  # Generate .next/ directory first
npm start      # Now safe to start
```

### "Module not found" or npm install failed

**Cause**: Wrong directory or corrupted files

**Solution**:
```bash
pwd                         # Verify location
ls -la                      # Check files exist
rm -rf node_modules         # Delete and reinstall
npm install
npm run build
npm start
```

### "Cannot login" or "Invalid credentials"

**Cause**: Different `NEXTAUTH_SECRET` than backup

**Solution**:
```bash
# Use .env.local from backup
cat .env.local | grep NEXTAUTH_SECRET
# Verify NEXTAUTH_SECRET matches original installation
pm2 restart rhcsolutions
```

### Empty site or missing menu/footer

**Cause**: Built before database was restored or database corrupted

**Solution**:
```bash
# Clear old build
rm -rf .next

# Rebuild (will use restored database)
npm run build

# Verify database loaded
sqlite3 cms-data/cms.db "SELECT COUNT(*) FROM pages;"

# Start fresh
npm start
```

### Port 3000/3001 already in use

**Solution**:
```bash
# Kill existing process
lsof -ti:3001 | xargs kill -9

# Or use different port
npm run dev -- -p 3003

# For production
PORT=3002 npm start
```

### Database locked or corrupted

**Cause**: Incomplete backup or concurrent access

**Solution**:
```bash
# Check WAL files
ls -la cms.db*

# Verify integrity
sqlite3 cms-data/cms.db "PRAGMA integrity_check;"

# If corrupted, restore from older backup
# Or rebuild from source

npm run build
pm2 restart rhcsolutions
```

### Pages/content not loading after restore

**Cause**: Database not connected or queries failing

**Solution**:
```bash
# Check database directly
sqlite3 cms-data/cms.db ".tables"
sqlite3 cms-data/cms.db "SELECT * FROM pages LIMIT 5;"

# Check server logs
pm2 logs rhcsolutions

# Verify .env.local has correct DATABASE_PATH
grep DATABASE_PATH .env.local

# Restart
pm2 restart rhcsolutions
```

---

## Security Considerations

### NEXTAUTH_SECRET - EXTREMELY IMPORTANT ⚠️

- Located in `.env.local`
- **CRITICAL** for authentication
- Without it: All logins fail, passwords invalid
- **Always** use `.env.local` from backup
- **Never** generate new NEXTAUTH_SECRET when restoring (breaks existing sessions)

### Environment Variables in Backups

Backups contain sensitive data:
- Database credentials
- API keys (Google, Cloudflare, etc.)
- Email service credentials
- Telegram bot tokens
- NextAuth secrets
- Recaptcha keys

**Protect backups accordingly!**
- Store in secure location
- Don't commit `.env.local` to git
- Encrypt before uploading to cloud
- Restrict file permissions: `chmod 600 .env.local`

---

## Disaster Recovery Scenarios

### Scenario 1: Database Corrupted

**Situation**: Database locked, can't access site

**Recovery**:
```bash
# 1. Get latest backup
ls -lt cms-data/backups/ | head -1

# 2. Restore database only
cp backup/cms-data/cms.db cms-data/cms.db

# 3. Verify integrity
sqlite3 cms-data/cms.db "PRAGMA integrity_check;"

# 4. Restart
pm2 restart rhcsolutions

# 5. Test site loads
curl https://yourdomain.com
```

### Scenario 2: Lost Admin Access

**Situation**: Can't login, forgot password

**Recovery**:
```bash
# 1. Restore .env.local from backup
cp backup/.env.local .env.local

# 2. Restart (will have correct NEXTAUTH_SECRET)
pm2 restart rhcsolutions

# 3. Try login again
# Username: admin@rhcsolutions.com
# Password: (from original setup or reset in admin panel)
```

### Scenario 3: Complete Site Failure

**Situation**: Site completely down, need emergency recovery

**Recovery**:
```bash
# 1. Get latest backup
LATEST=$(ls -t cms-data/backups/*.zip | head -1)

# 2. Restore to temporary location
unzip "$LATEST" -d /tmp/recovery
cd /tmp/recovery

# 3. Verify it works
npm install --production
npm run build
npm start

# 4. If successful, swap over production
sudo systemctl stop rhcsolutions  # Or pm2 stop
cp -r /tmp/recovery/* /var/www/rhcsolutions.com/
sudo systemctl start rhcsolutions  # Or pm2 start

# 5. Verify
curl https://yourdomain.com
```

### Scenario 4: Accidental Content Deletion

**Situation**: Important page/content deleted

**Recovery**:
```bash
# 1. Find backup created before deletion
ls -lh cms-data/backups/

# 2. Restore just the database from that backup
unzip backup-YYYY-MM-DD.zip -d /tmp/restore_point
cp /tmp/restore_point/cms-data/cms.db cms-data/cms.db

# 3. Restart to load old data
pm2 restart rhcsolutions

# 4. Manually copy back lost content if needed
# Use admin panel to copy content from restored version
```

---

## Best Practices

✅ **Regular Backups**
- Keep automated daily backups enabled
- Test restoration monthly
- Manual backup before major changes
- Document backup locations

✅ **Storage Strategy**
- Local copies (on server): 14-day retention
- Cloud backup (Telegram): Off-site safety
- External storage (S3, etc.): For long-term archival
- Encrypted copies: For sensitive data
- Multiple geographic locations: For disaster recovery

✅ **Testing**
- Test restoration quarterly
- Use staging server for tests
- Verify all pages load
- Check admin functionality
- Test authentication
- Confirm media uploads work

✅ **Documentation**
- Keep `NEXTAUTH_SECRET` safe
- Document backup schedule
- Record manual backups
- Note any failed backups
- Track restoration tests

---

## Testing Backups

### Monthly Test Procedure

```bash
# 1. Get latest backup
BACKUP=$(ls -t cms-data/backups/*.zip | head -1)

# 2. Create test environment
mkdir -p /tmp/backup_test
unzip "$BACKUP" -d /tmp/backup_test
cd /tmp/backup_test

# 3. Verify restore process
npm install --production
npm run build
npm start &
PID=$!

# 4. Test key functionality
sleep 5  # Wait for startup

echo "Testing homepage..."
curl http://localhost:3000 | grep -q "RHC Solutions" && echo "✅ Homepage OK" || echo "❌ Homepage Failed"

echo "Testing API..."
curl http://localhost:3000/api/cms/settings | grep -q "settings" && echo "✅ API OK" || echo "❌ API Failed"

# 5. Cleanup
kill $PID
cd /

echo "Backup test complete!"
```

### Automated Testing (Backup Restore Complete)

```bash
npx tsx scripts/test-backup-restore-complete.ts
```

---

## Retention Policy

Backups are automatically cleaned up:
- **Local backups**: 14 days retention
- **Telegram backups**: Manual cleanup (unlimited size if space available)
- **Manual backups**: Keep indefinitely (user responsibility)

To manually clean old backups:
```bash
# Find backups older than 30 days
find cms-data/backups/ -name "*.zip" -mtime +30 -ls

# Delete old backups
find cms-data/backups/ -name "*.zip" -mtime +30 -delete

# Verify
ls -lh cms-data/backups/
```

---

**Last Updated**: January 9, 2026
