const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const app = express();
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('railway.internal') ? { rejectUnauthorized: false } : false
});

async function setup() {
  await db.query(`CREATE TABLE IF NOT EXISTS mesajlar (
    id SERIAL PRIMARY KEY, ad TEXT NOT NULL, telefon TEXT NOT NULL, eposta TEXT,
    urun TEXT, mesaj TEXT NOT NULL, tarih TIMESTAMPTZ DEFAULT now())`);
  await db.query(`CREATE TABLE IF NOT EXISTS uyeler (
    id SERIAL PRIMARY KEY, ad TEXT NOT NULL, eposta TEXT UNIQUE NOT NULL, telefon TEXT,
    sifre_hash TEXT NOT NULL, kampanya BOOLEAN DEFAULT false, tarih TIMESTAMPTZ DEFAULT now())`);
}

app.use(express.json({ limit: '20kb' }));

app.post('/api/iletisim', async (req, res) => {
  const { ad, telefon, eposta, urun, mesaj } = req.body || {};
  if (!ad || !telefon || !mesaj) return res.status(400).json({ hata: 'Eksik alan' });
  try {
    await db.query('INSERT INTO mesajlar (ad, telefon, eposta, urun, mesaj) VALUES ($1,$2,$3,$4,$5)', [ad, telefon, eposta || null, urun || null, mesaj]);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ hata: 'Sunucu hatası' }); }
});

app.post('/api/kayit', async (req, res) => {
  const { ad, eposta, telefon, sifre, kvkk, kampanya } = req.body || {};
  if (!ad || !eposta || !sifre || sifre.length < 8 || !kvkk) return res.status(400).json({ hata: 'Eksik alan' });
  try {
    const hash = await bcrypt.hash(sifre, 10);
    await db.query('INSERT INTO uyeler (ad, eposta, telefon, sifre_hash, kampanya) VALUES ($1,$2,$3,$4,$5)', [ad, eposta.toLowerCase(), telefon || null, hash, !!kampanya]);
    res.json({ ok: true });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ hata: 'Bu e-posta kayıtlı' });
    console.error(e); res.status(500).json({ hata: 'Sunucu hatası' });
  }
});

// Basit yönetim sayfası: /yonetim  (kullanıcı adı: admin, şifre: ADMIN_SIFRE değişkeni)
app.get('/yonetim', async (req, res) => {
  const [u, p] = Buffer.from((req.headers.authorization || '').split(' ')[1] || '', 'base64').toString().split(':');
  if (!process.env.ADMIN_SIFRE || u !== 'admin' || p !== process.env.ADMIN_SIFRE) {
    res.set('WWW-Authenticate', 'Basic realm="Yonetim"'); return res.status(401).send('Giriş gerekli');
  }
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const tarih = d => new Date(d).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
  const m = (await db.query('SELECT * FROM mesajlar ORDER BY tarih DESC')).rows;
  const k = (await db.query('SELECT ad, eposta, telefon, kampanya, tarih FROM uyeler ORDER BY tarih DESC')).rows;
  const tablo = (baslik, cols, rows) => `<h2>${baslik} (${rows.length})</h2><table><tr>${cols.map(c => `<th>${c[0]}</th>`).join('')}</tr>${rows.map(r => `<tr>${cols.map(c => `<td>${c[1](r)}</td>`).join('')}</tr>`).join('')}</table>`;
  res.send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Yönetim</title>
<style>body{font-family:system-ui,sans-serif;color:#14213d;max-width:1100px;margin:40px auto;padding:0 20px}h1{margin:0 0 8px}h2{margin:40px 0 12px}table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:10px;border-bottom:1px solid #e6e9ef;vertical-align:top}th{background:#f6f7fa}</style>
<h1>Yıldız Mobilya — Yönetim</h1>
${tablo('Mesajlar', [['Tarih', r => tarih(r.tarih)], ['Ad', r => esc(r.ad)], ['Telefon', r => esc(r.telefon)], ['E-posta', r => esc(r.eposta)], ['Ürün', r => esc(r.urun)], ['Mesaj', r => esc(r.mesaj)]], m)}
${tablo('Üyeler', [['Tarih', r => tarih(r.tarih)], ['Ad', r => esc(r.ad)], ['E-posta', r => esc(r.eposta)], ['Telefon', r => esc(r.telefon)], ['Kampanya', r => r.kampanya ? 'Evet' : 'Hayır']], k)}`);
});

app.get(['/server.js', '/package.json'], (req, res) => res.status(404).end());
app.use(express.static(__dirname, { index: 'index.html', dotfiles: 'ignore' }));

const port = process.env.PORT || 3000;
setup().then(() => app.listen(port, '0.0.0.0', () => console.log('Sunucu çalışıyor: ' + port)))
  .catch(e => { console.error('Veritabanı bağlantı hatası:', e.message); process.exit(1); });
