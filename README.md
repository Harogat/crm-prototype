# Mini-CRM Prototype (Starter-Pack)

Dieses Paket enthält:
- `app5/` – deine Web-App (HTML/CSS/JS)
- `.github/workflows/pages.yml` – GitHub Actions für GitHub Pages Deploy
- `docs/ARCHITECTURE.md` – Architektur & Phasenplan
- `.gitignore`
- `roadmap.csv` – Importierbare Roadmap

## Deploy (GitHub Pages)
1. In GitHub ein neues Repo erstellen (z. B. `Harogat/crm-prototype`).
2. Den **gesamten Inhalt** dieses Pakets in das Repo hochladen (Root-Ebene).
3. GitHub → **Settings → Pages** → Build & deployment: **GitHub Actions**.
4. Nach dem Commit published der Workflow automatisch `app5/` als Website.

URL: `https://<dein-user>.github.io/<repo>`

## Lokal starten
Öffne `app5/index.html` im Browser. Für Dev-Server: `npx serve app5`.
