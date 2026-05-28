# Daily Brief — ระบบข่าวอัตโนมัติประจำวัน

เว็บแอปอ่านข่าว design / AI / tech / เศรษฐกิจ / หุ้น พร้อมสรุปไทยด้วย AI อัปเดตทุกเช้า 7:00

## Stack
- Backend: Python + feedparser + Gemini API
- Frontend: HTML + Tailwind (CDN) + vanilla JS
- Auto: GitHub Actions (cron 0:00 UTC = 7:00 ICT)
- Hosting: Cloudflare Pages

## โครงสร้าง
```
news-app/
├── feeds.json                       # รายการ RSS sources (แก้ไขเพิ่ม/ลดได้)
├── scripts/
│   ├── fetch_news.py                # อ่าน RSS + สรุปไทย + เขียน JSON
│   └── requirements.txt
├── public/                          # → Cloudflare Pages root
│   ├── index.html
│   ├── app.js
│   └── data/
│       ├── news.json                # ข่าววันนี้
│       └── archive/YYYY-MM-DD.json  # archive
└── .github/workflows/daily-news.yml # cron job
```

## Setup (ครั้งแรก ~15 นาที)

### 1. สร้าง repo และ push โค้ด
```bash
cd news-app
git init
git add .
git commit -m "init"
# สร้าง repo ใหม่บน github.com แล้ว
git remote add origin git@github.com:YOUR_USER/news-app.git
git push -u origin main
```

### 2. ขอ Gemini API key (ฟรี)
- ไปที่ https://aistudio.google.com/apikey
- กด **Create API key** → copy key

### 3. ใส่ key ใน GitHub Secrets
- ไปที่ repo → **Settings → Secrets and variables → Actions → New repository secret**
- Name: `GEMINI_API_KEY`
- Value: vaste key

### 4. ทดสอบ workflow
- ไปที่ **Actions** tab → **Daily News Update** → **Run workflow**
- รอ ~2-3 นาที ดูว่า commit `public/data/news.json` ขึ้นมาไหม

### 5. Deploy Cloudflare Pages (ฟรี)
- ไปที่ https://dash.cloudflare.com → **Workers & Pages → Create → Pages → Connect to Git**
- เลือก repo `news-app`
- ตั้งค่า:
  - Build command: *(เว้นว่าง)*
  - Build output directory: `public`
- กด **Save and Deploy** → ได้ URL `your-app.pages.dev` 🎉

### 6. ตั้ง custom domain (ถ้ามี)
- ใน Pages project → **Custom domains → Set up a custom domain**
- ฟรีไม่มีค่าใช้จ่าย

## การใช้งานประจำ

**เพิ่ม/ลด RSS sources:**
แก้ไข `feeds.json` แล้ว push — workflow ครั้งถัดไปจะใช้ list ใหม่

**Test local:**
```bash
cd scripts
pip install -r requirements.txt
export GEMINI_API_KEY=your_key
python fetch_news.py
# เปิด public/index.html ใน browser
```

**ดูประวัติข่าว:**
ทุกวันจะถูก archive ที่ `public/data/archive/YYYY-MM-DD.json`

## ต้นทุน
- GitHub Actions: ฟรี (ใช้ ~5 นาที/วัน = 150/2000 นาที/เดือน)
- Cloudflare Pages: ฟรี ไม่จำกัด bandwidth
- Gemini API: ฟรี 1,500 req/วัน (ใช้ ~1 req/วัน เพราะ batch ทั้งหมด)
- **รวม: 0 บาท/เดือน**
