# 📚 Documentation Index

Welcome to the RHC Solutions documentation! This folder contains comprehensive guides for all aspects of the project.

---

## 🚀 Getting Started

Start here if you're new to the project:

1. **[Main README](../README.md)** - Project overview & quick start
2. **[DEPLOYMENT.md](./DEPLOYMENT.md)** - How to deploy the application
3. **[TECHNICAL.md](./TECHNICAL.md)** - Architecture & tech stack

---

## 📖 Core Guides

### For Administrators
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Deploy to Vercel, PM2, Docker
- **[BACKUP_RECOVERY.md](./BACKUP_RECOVERY.md)** - Automated & manual backups
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Common issues & solutions

### For Developers
- **[TECHNICAL.md](./TECHNICAL.md)** - Database schema, API endpoints, code structure
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Build errors, debugging

---

## 🗂️ Documentation Files

| File | Purpose | Audience |
|------|---------|----------|
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Server setup, deployment options, SSL/HTTPS | Admins, DevOps |
| [BACKUP_RECOVERY.md](./BACKUP_RECOVERY.md) | Backup procedures, disaster recovery | Admins, Operators |
| [TECHNICAL.md](./TECHNICAL.md) | Architecture, database, API, performance | Developers |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Common issues & solutions | Everyone |
| [CHANGELOG_PERFORMANCE.md](./CHANGELOG_PERFORMANCE.md) | Performance optimization history | Developers |
| [SECURITY_REMEDIATION.md](./SECURITY_REMEDIATION.md) | Pen‑test & secret‑remediation log | Developers, Admins |

---

## 🧾 Audit Reports

Dated audits and remediation plans. Treat as point‑in‑time snapshots — check the Progress Log at the end of each doc for current status before acting on its recommendations.

| File | Topic | Date |
|------|-------|------|
| [AUDIT_SEO_2026-05-18.md](./AUDIT_SEO_2026-05-18.md) | Deep SEO audit + phased improvement plan (Phase 1 ✅) | 2026‑05‑18 |
| [AUDIT_BRAND_2026-05-11.md](./AUDIT_BRAND_2026-05-11.md) | Brand consistency audit | 2026‑05‑11 |
| [AUDIT_DESIGN_SEO_UX_2026-05-11.md](./AUDIT_DESIGN_SEO_UX_2026-05-11.md) | Design / SEO / UX combined audit | 2026‑05‑11 |
| [QA_AUDIT_2026-04-21.md](./QA_AUDIT_2026-04-21.md) | QA audit | 2026‑04‑21 |

---

## 📋 Quick Reference

### Deployment Options
- **Vercel** - Fastest, recommended for most users (5 mins)
- **PM2** - For VPS/dedicated servers with Node.js
- **Docker** - Containerized deployment
- See [DEPLOYMENT.md](./DEPLOYMENT.md)

### Critical Operations
- **Create Backup**: Go to `/admin/backups` → Click "Create Backup Now"
- **Restore from Backup**: `unzip backup.zip && npm install && npm run build && npm start`
- **Access Admin**: https://yourdomain.com/admin/login
- **View Logs**: `pm2 logs rhcsolutions`
- **Check Status**: `pm2 status`

---

## 🔧 Environment Variables

Required variables (see [TECHNICAL.md](./TECHNICAL.md#environment-configuration)):
- `NEXTAUTH_URL` - Your domain
- `NEXTAUTH_SECRET` - Secure random string
- `CLOUDFLARE_API_TOKEN` - For CDN integration
- `NEXT_PUBLIC_GA_PROPERTY_ID` - For Google Analytics

---

## 🆘 Common Issues

| Issue | Solution |
|-------|----------|
| Can't login | Check NEXTAUTH_SECRET in .env.local |
| Port in use | `lsof -ti:3001 \| xargs kill -9` |
| Build fails | `rm -rf .next && npm install && npm run build` |
| Slow performance | Check CDN status and cache headers |
| Database issues | See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md#database-issues) |

**Full troubleshooting guide**: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

---

## 📊 System Information

- **Framework**: Next.js 16 + React 19 + TypeScript 5.7
- **Database**: SQLite (92 KB)
- **Build Time**: 3-4 seconds
- **Routes**: 77 total
- **Page Load**: <500ms (with CDN)
- **Vulnerabilities**: 0

See [TECHNICAL.md](./TECHNICAL.md) for full details.

---

## 🔗 External Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [NextAuth.js Guide](https://next-auth.js.org/)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [Cloudflare Docs](https://developers.cloudflare.com/docs/)
- [Google Analytics API](https://developers.google.com/analytics/devguides/reporting/data/v1)

---

## 🗂️ Archive

Historical documentation is preserved in the parent folder:
- [docs_archived/](../) - Earlier guides, archived notes

---

## ✍️ Documentation Maintenance

This documentation is actively maintained. Files are updated whenever:
- Major features are added
- Deployment procedures change
- Common issues are discovered
- Performance improvements are made

Last updated: **January 9, 2026**

---

## 💡 Tips

- **Search**: Use Ctrl+F to search within documents
- **Code blocks**: Copy code examples with the copy button
- **Terminal commands**: Replace `yourdomain.com` with your actual domain
- **Sensitive data**: Never commit `.env.local` to git
- **Backups**: Test restoration quarterly

---

**Need help?** Check the [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) guide or review relevant sections above.
