# Orbucx

**DevOps & Cloud Consulting Services**

A modern, fast, and fully responsive website for Orbucx — a full-service cloud engineering practice for startups and SMBs.

🌐 **Live:** [orbucx.com](https://orbucx.com)

---

## ✨ Features

- **Static Site** — Pure HTML, CSS, JavaScript. No frameworks, no build steps.
- **Fast** — Optimized for Core Web Vitals and instant loading.
- **Responsive** — Works on all devices (mobile, tablet, desktop).
- **SEO Ready** — Meta tags, Open Graph, Schema.org structured data, sitemap.
- **Accessible** — Semantic HTML, ARIA labels, keyboard navigation.
- **Dark Theme** — Modern dark UI with gradient accents.

---

## 🛠️ DevOps Tools

Free, browser-based script generators at `/tools.html`:

| Tool | Description |
|------|-------------|
| Nginx + SSL | Reverse proxy with Certbot auto-SSL |
| Docker | Commands, Dockerfile, multistage, docker-compose |
| Kubernetes | Deployment, Service, Ingress, HPA manifests |
| CI/CD | GitHub Actions for PM2, Docker, ECS |
| EC2 Setup | Ubuntu server provisioning scripts |
| AWS CLI | Configuration commands |
| IAM Policy | Least-privilege policy generator |
| Terraform | Infrastructure starter templates |
| systemd | Service unit file generator |
| S3 Backup | Database backup scripts |
| SSH Hardening | Security configuration |
| OpenVPN | VPN server setup |

All scripts run **100% client-side** — nothing leaves your browser.

---

## 📁 Project Structure

```
orbucx/
├── index.html      # Main landing page
├── tools.html      # DevOps tools page
├── styles.css      # Main stylesheet
├── tools.css       # Tools page styles
├── script.js       # Main JavaScript
├── tools.js        # Tools functionality
├── sitemap.xml     # SEO sitemap
├── robots.txt      # Crawler directives
└── README.md       # This file
```

---

## 🚀 Deployment

### Cloudflare Pages (Recommended)

1. Push to GitHub
2. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → Workers & Pages
3. Create → Pages → Connect to Git
4. Select this repository
5. Deploy

### Other Options

- **Vercel:** Import from GitHub, zero config
- **Netlify:** Drag & drop or Git deploy
- **GitHub Pages:** Enable in repo settings

---

## 🔧 Local Development

No build tools required. Just open in browser:

```bash
# Clone
git clone https://github.com/orbucx/orbucx-web.git
cd orbucx-web

# Open in browser
open index.html
# or use a local server
npx serve .
```

---

## 📝 License

© 2024 Orbucx. All rights reserved.

---

## 📬 Contact

- **Website:** [orbucx.com](https://orbucx.com)
- **Email:** hello@orbucx.com
