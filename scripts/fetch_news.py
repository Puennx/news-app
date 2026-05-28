"""
Daily news aggregator + Thai summarizer.

อ่าน RSS feeds จาก feeds.json → กรองข่าวใน 24 ชม. → dedupe →
ส่งทั้ง batch ให้ Gemini สรุปไทย → เขียน public/data/news.json + archive
"""
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import feedparser
from google import genai
from google.genai import types as genai_types
from dateutil import parser as date_parser

# ---------- Config ----------
ROOT = Path(__file__).parent.parent
FEEDS_FILE = ROOT / "feeds.json"
OUTPUT_DIR = ROOT / "public" / "data"
ARCHIVE_DIR = OUTPUT_DIR / "archive"

LOOKBACK_HOURS = 24       # ดึงข่าวย้อนหลังกี่ชั่วโมง
MAX_PER_FEED = 5          # จำนวนข่าวสูงสุดต่อแหล่ง
MODEL_NAME = "gemini-2.0-flash"   # ฟรี 1,500 req/day

# ---------- Init ----------
api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    sys.exit("ERROR: GEMINI_API_KEY environment variable not set")

client = genai.Client(api_key=api_key)


# ---------- Fetch ----------
def fetch_feed(feed_cfg):
    """ดึงข่าวจาก 1 feed กรองเฉพาะข่าวใน LOOKBACK_HOURS ชั่วโมง"""
    name = feed_cfg["name"]
    try:
        parsed = feedparser.parse(feed_cfg["url"])
    except Exception as e:
        print(f"[FAIL] {name}: {e}", file=sys.stderr)
        return []

    if parsed.bozo and not parsed.entries:
        print(f"[WARN] {name}: parse error, no entries", file=sys.stderr)
        return []

    cutoff = datetime.now(timezone.utc) - timedelta(hours=LOOKBACK_HOURS)
    entries = []

    for entry in parsed.entries[:MAX_PER_FEED]:
        published = _get_published_dt(entry)
        if published is None or published < cutoff:
            continue

        title = (entry.get("title") or "").strip()
        link = entry.get("link", "")
        summary = _clean_html(entry.get("summary", ""))[:500]

        if not title or not link:
            continue

        entries.append({
            "source": name,
            "category": feed_cfg["category"],
            "title": title,
            "link": link,
            "summary_raw": summary,
            "published": published.isoformat(),
        })

    print(f"[OK] {name}: {len(entries)} entries")
    return entries


def _get_published_dt(entry):
    """หาว่าข่าว publish เมื่อไหร่ จาก field ต่าง ๆ"""
    for key in ("published", "updated", "created"):
        raw = entry.get(key)
        if not raw:
            continue
        try:
            dt = date_parser.parse(raw)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except Exception:
            continue
    return None


def _clean_html(text):
    """ลบ HTML tags แบบหยาบ ๆ พอใช้ได้สำหรับ summary"""
    import re
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


# ---------- Dedupe ----------
def dedupe(entries):
    seen_titles = set()
    seen_links = set()
    out = []
    for e in entries:
        title_key = e["title"].lower()[:60]
        link_key = e["link"]
        if title_key in seen_titles or link_key in seen_links:
            continue
        seen_titles.add(title_key)
        seen_links.add(link_key)
        out.append(e)
    return out


# ---------- Summarize ----------
def summarize_batch(entries):
    """ส่งทั้งหมดเป็น batch เดียว ประหยัด quota และเร็ว"""
    if not entries:
        return entries

    items_text = "\n\n".join(
        f"[{i}]\nหัวข้อ: {e['title']}\nเนื้อหา: {e['summary_raw']}"
        for i, e in enumerate(entries)
    )

    prompt = f"""สรุปข่าวต่อไปนี้เป็นภาษาไทยกระชับ ข่าวละ 2-3 บรรทัด (60-100 คำ)
เน้นใจความสำคัญและตัวเลข/ชื่อสำคัญ ไม่ต้องเกริ่นนำ ไม่ต้องอวย ไม่ขึ้นต้นด้วย "ข่าวนี้..."
ถ้าเนื้อหาภาษาอังกฤษให้แปลเป็นไทย ถ้าเป็นไทยอยู่แล้วก็เรียบเรียงใหม่ให้สั้นลง

ตอบเป็น JSON array เท่านั้น รูปแบบ:
[{{"index": 0, "summary_th": "..."}}, {{"index": 1, "summary_th": "..."}}, ...]

ข่าว:
{items_text}"""

    try:
        resp = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config=genai_types.GenerateContentConfig(
                response_mime_type="application/json"
            ),
        )
        results = json.loads(resp.text)
        for r in results:
            idx = r.get("index")
            if idx is not None and 0 <= idx < len(entries):
                entries[idx]["summary_th"] = r.get("summary_th", "").strip()
    except Exception as e:
        print(f"[WARN] Gemini batch failed: {e}", file=sys.stderr)

    # เผื่อบางอันไม่ได้สรุป ใส่ค่าเริ่มต้น
    for e in entries:
        e.setdefault("summary_th", "")

    return entries


# ---------- Main ----------
def main():
    if not FEEDS_FILE.exists():
        sys.exit(f"ERROR: {FEEDS_FILE} not found")

    with open(FEEDS_FILE, "r", encoding="utf-8") as f:
        feeds = json.load(f)

    print(f"Loaded {len(feeds)} feeds")

    all_entries = []
    for feed in feeds:
        all_entries.extend(fetch_feed(feed))

    print(f"\nTotal fetched: {len(all_entries)}")
    all_entries = dedupe(all_entries)
    print(f"After dedupe:  {len(all_entries)}")

    if not all_entries:
        print("No news today, writing empty payload")

    all_entries = summarize_batch(all_entries)
    all_entries.sort(key=lambda x: x["published"], reverse=True)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)

    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    payload = {
        "updated_at": now.isoformat(),
        "date": today,
        "count": len(all_entries),
        "items": all_entries,
    }

    # current
    with open(OUTPUT_DIR / "news.json", "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    # archive
    with open(ARCHIVE_DIR / f"{today}.json", "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"\nWrote {len(all_entries)} entries")
    print(f"  -> {OUTPUT_DIR / 'news.json'}")
    print(f"  -> {ARCHIVE_DIR / f'{today}.json'}")


if __name__ == "__main__":
    main()
