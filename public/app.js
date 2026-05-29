const CATEGORIES = {
  all:     { label: 'ทั้งหมด',  badge: null },
  design:  { label: 'ดีไซน์',   badge: { bg: '#FAEEDA', fg: '#633806' } },
  ai:      { label: 'AI',        badge: { bg: '#EEEDFE', fg: '#3C3489' } },
  tech:    { label: 'Tech',      badge: { bg: '#E6F1FB', fg: '#0C447C' } },
  economy: { label: 'เศรษฐกิจ', badge: { bg: '#E1F5EE', fg: '#085041' } },
  stock:   { label: 'หุ้น',      badge: { bg: '#FDE8EA', fg: '#7C1318' } },
};

let allItems = [];
let activeFilter = 'all';

async function load() {
  try {
    const res = await fetch(`data/news.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    allItems = data.items || [];

    const when = new Date(data.updated_at);
    const dateStr = when.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
    const timeStr = when.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
    document.getElementById('updated').textContent = `${dateStr} ${timeStr} · ${data.count} ข่าว`;

    renderFilters();
    render();
  } catch (err) {
    document.getElementById('updated').textContent = 'โหลดไม่สำเร็จ — ลอง refresh';
    console.error(err);
  }
}

function renderFilters() {
  const counts = { all: allItems.length };
  for (const item of allItems) {
    counts[item.category] = (counts[item.category] || 0) + 1;
  }

  const root = document.getElementById('filters');
  root.innerHTML = Object.entries(CATEGORIES)
    .filter(([key]) => key === 'all' || counts[key])
    .map(([key, { label }]) => {
      const isActive = key === activeFilter;
      return `<button data-cat="${key}" class="filter-btn ${isActive ? 'active' : 'inactive'}">
        ${label} <span class="count">${counts[key] || 0}</span>
      </button>`;
    })
    .join('');

  root.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.cat;
      renderFilters();
      render();
    });
  });
}

function render() {
  const newsEl = document.getElementById('news');
  const emptyEl = document.getElementById('empty');
  const items = activeFilter === 'all' ? allItems : allItems.filter(i => i.category === activeFilter);

  if (!items.length) {
    newsEl.innerHTML = '';
    emptyEl.style.display = 'block';
    return;
  }
  emptyEl.style.display = 'none';
  newsEl.innerHTML = items.map(renderCard).join('');
}

function renderCard(item) {
  const cat = CATEGORIES[item.category] || { label: item.category, badge: { bg: '#F0F0F0', fg: '#555' } };
  const badgeStyle = cat.badge
    ? `style="background:${cat.badge.bg};color:${cat.badge.fg}"`
    : 'style="background:#F0F0F0;color:#555"';

  const summary = item.summary_th || item.summary_raw || '';

  return `
    <article>
      <div class="card-meta">
        <span class="badge" ${badgeStyle}>${cat.label}</span>
        <span class="card-source">${escapeHtml(item.source)}</span>
        <span class="card-dot">·</span>
        <span class="card-time">${formatTime(item.published)}</span>
      </div>
      <a href="${escapeAttr(item.link)}" target="_blank" rel="noopener" class="card-title">${escapeHtml(item.title)}</a>
      ${summary ? `<p class="card-summary">${escapeHtml(summary)}</p>` : ''}
      <div class="card-footer">
        <a href="${escapeAttr(item.link)}" target="_blank" rel="noopener" class="card-read-more">อ่านต้นฉบับ ↗</a>
      </div>
    </article>
  `;
}

function formatTime(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 60000;
  if (diff < 60) return `${Math.round(diff)} นาที ที่แล้ว`;
  if (diff < 1440) return `${Math.round(diff / 60)} ชม. ที่แล้ว`;
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s ?? '';
  return d.innerHTML;
}

function escapeAttr(s) {
  return String(s ?? '').replace(/"/g, '&quot;');
}

load();
