# 🚀 Deployment Guide

## ⚠️ Production Server Path

On the live production server (`web01`), this project is installed at:

```
/home/rhcsolutions/htdocs/rhcsolutions.com
```

**All commands below assume that working directory.** Running `npm run build` from `/home/rhcsolutions/htdocs` will fail with `ENOENT: no such file or directory, open '/home/rhcsolutions/htdocs/package.json'`. Always `cd` into the project root first:

```bash
cd /home/rhcsolutions/htdocs/rhcsolutions.com
```

The redeploy one‑liner used after code changes:

```bash
cd /home/rhcsolutions/htdocs/rhcsolutions.com && npm run build && pm2 restart ecosystem.config.js
```

---

## Quick Deploy Options

### Vercel (Recommended - 5 minutes)
```bash
git push origin main
# Visit https://vercel.com/new → Import repo → Add env vars → Deploy
```

### PM2 on VPS
```bash
ssh user@your-server-ip
cd /var/www && git clone <repo-url> rhcsolutions.com && cd rhcsolutions.com
npm install
nano .env.local  # Add all env variables
npm run build
pm2 start ecosystem.config.js
pm2 startup && pm2 save
```

### Docker
```bash
docker build -t rhcsolutions .
docker run -p 3001:3001 --env-file .env.local -v $(pwd)/cms-data:/app/cms-data rhcsolutions
```

---

## Environment Variables Required

```bash
# Authentication (REQUIRED)
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=<openssl rand -base64 32>

# Google Analytics 4
NEXT_PUBLIC_GA_PROPERTY_ID=123456789
NEXT_PUBLIC_GA_SERVICE_ACCOUNT_EMAIL=...@iam.gserviceaccount.com
GA_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\n...

# Cloudflare
CLOUDFLARE_API_TOKEN=<token>
NEXT_PUBLIC_CLOUDFLARE_ZONE_ID=<zone-id>
CLOUDFLARE_ACCOUNT_ID=<account-id>
NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY=...
CLOUDFLARE_TURNSTILE_SECRET_KEY=...

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Hotjar
NEXT_PUBLIC_HOTJAR_SITE_ID=1234567

# Telegram Backups (optional)
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=-123456789
```

---

## Post-Deployment Checklist

- [ ] Environment variables configured
- [ ] Database auto-initialized
- [ ] HTTPS/SSL enabled
- [ ] Homepage loads: `curl https://yourdomain.com`
- [ ] Admin panel accessible: `https://yourdomain.com/admin/login`
- [ ] API responds: `curl https://yourdomain.com/api/cms/settings`
- [ ] Backups enabled (check `/admin/backups`)
- [ ] Analytics configured (check `/admin/analytics`)
- [ ] Default credentials changed

---

## Production Server Setup (Detailed)

### Prerequisites
- Node.js 18+
- npm/yarn
- PM2 or Docker
- Nginx (optional, for reverse proxy)
- SSL certificate (Let's Encrypt or other)

### Step 1: Clone and Setup
```bash
# SSH into server
ssh user@your-server-ip

# Clone repository
cd /var/www
git clone <your-repo-url> rhcsolutions.com
cd rhcsolutions.com

# Install dependencies
npm install
```

### Step 2: Configure Environment
```bash
# Create .env.local with all required variables
nano .env.local
```

Add all variables from the list above.

### Step 3: Build for Production
```bash
npm run build
# Should complete in 3-4 seconds
# Output: 77 routes, builds to .next/
```

### Step 4: Start with PM2
```bash
# Install PM2 globally (if not already)
npm install -g pm2

# Start application
pm2 start ecosystem.config.js

# Enable auto-start on server reboot
pm2 startup
pm2 save

# Check status
pm2 status
```

### Step 5: Configure Nginx (Optional)
If using Nginx as reverse proxy:

```bash
sudo nano /etc/nginx/sites-available/rhcsolutions.com
```

```nginx
server {
    listen 80;
    server_name rhcsolutions.com www.rhcsolutions.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name rhcsolutions.com www.rhcsolutions.com;
    
    ssl_certificate /etc/letsencrypt/live/rhcsolutions.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rhcsolutions.com/privkey.pem;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    
    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/rhcsolutions.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 6: Setup SSL (Let's Encrypt)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d rhcsolutions.com -d www.rhcsolutions.com
sudo certbot renew --dry-run  # Test auto-renewal
```

---

## Database Initialization

On first startup, the system automatically creates:
- Pages table (with SEO metadata)
- Media table
- Settings table (navigation, footer, theme, etc.)
- Users table (admin accounts)
- Forms table + submissions
- Backups table + metadata

Default navigation includes:
- Home, About Us, Services, Careers, Contact
- Services submenu: IT Consulting, Professional Services, etc.

---

## Monitoring & Maintenance

### Check Status
```bash
pm2 status
pm2 logs rhcsolutions --lines 50
pm2 monit  # Real-time monitoring
```

### View Logs
```bash
# Recent logs
pm2 logs rhcsolutions

# Follow in real-time
pm2 logs rhcsolutions --stream

# Clear logs
pm2 flush
```

### Restart/Stop
```bash
pm2 restart rhcsolutions    # Restart app
pm2 stop rhcsolutions        # Stop app (won't auto-start on reboot)
pm2 delete rhcsolutions      # Remove from PM2
```

### Update Dependencies
```bash
npm outdated      # Check for updates
npm update        # Update packages
npm audit         # Check security
npm audit fix     # Fix vulnerabilities
```

---

## Performance Optimization

### Enable HTTP/2 and Gzip
Already configured in Nginx example above.

### Monitor Performance
```bash
pm2 monit  # Real-time CPU/memory

# Check page load time
curl -w "@curl-format.txt" https://rhcsolutions.com
```

### Database Performance
Database uses SQLite with WAL (Write-Ahead Logging) for:
- Concurrent read access
- Fast local queries (<5ms)
- No network latency

---

## Troubleshooting

**Port 3001 already in use**
```bash
lsof -ti:3001 | xargs kill -9
```

**Can't connect to database**
```bash
# Check database files exist
ls -la cms.db*

# Rebuild
npm run build
pm2 restart rhcsolutions
```

**Out of memory**
```bash
# Increase Node.js memory
pm2 start ecosystem.config.js --max-memory-restart 500M
```

**SSL certificate issues**
```bash
sudo certbot renew --force-renewal
sudo systemctl restart nginx
pm2 restart rhcsolutions
```

---

**Last Updated**: January 9, 2026
