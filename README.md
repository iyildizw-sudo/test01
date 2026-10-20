# Kişisel Site

## 1. GitHub
```bash
cd deploy
git init
git add .
git commit -m "İlk sürüm"
git branch -M main
git remote add origin https://github.com/KULLANICI_ADI/kisisel-site.git
git push -u origin main
```
(Önce github.com/new adresinden boş bir `kisisel-site` deposu oluşturun.)

## 2. Railway
1. railway.app → **New Project** → **Deploy from GitHub repo** → `kisisel-site` seçin.
2. Railway `package.json`'u algılar, `npm start` ile yayınlar.
3. **Settings → Networking → Generate Domain** ile genel adresi alın.
