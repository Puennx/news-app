// ---------- Config ----------
const CATEGORIES = {
  all:      { label: 'ทั้งหมด',   color: 'neutral' },
  design:   { label: 'ดีไซน์',    color: 'amber'   },
  ai:       { label: 'AI',         color: 'violet'  },
  tech:     { label: 'Tech',       color: 'sky'     },
  economy:  { label: 'เศรษฐกิจ',  color: 'emerald' },
  stock:    { label: 'หุ้น',       color: 'rose'    },
};

let allItems = [];
let activeFilter = 'all';

// ---------- Load ----------
async function load() {
  const updated = document.getElementById('updated');
  try {
    const res = await fetch(`data/news.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    allItems = data.items || [];

    const when = new Date(data.updated_at);
    updated.textContent =
      `อัปเดต ${when.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })} • ${data.count} ข่าว`;

    renderFilters();
    render();
  } catch (err) {
    updated.textContent = 'โหลดข่าวไม่สำเร็จ — ลอง refresh อีกครั้ง';
    console.error(err);
  }
}

// ---------- Filters ----------
function renderFilters() {
  const counts = { all: allItems.length };
  for (const item of allItems) {
    counts[item.category] = (counts[item.category] || 0) + 1;
  }

  const root = document.getElementById('filters');
  const html = Object.entries(CATEGORIES)
    .filter(([key]) => key === 'all' || counts[key])
    .map(([key, { label }]) => {
      const isActive = key === activeFilter;
      const cls = isActive
        ? 'bg-neutral-900 text-white border-neutral-900'
        : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400';
      return `<button data-cat="${key}"
                class="px-3 py-1.5 rounded-full text-sm border transition ${cls}">
                ${label}
                <span class="opacity-60 ml-0.5">${counts[key] || 0}</span>
              </button>`;
    })
    .join('');

  root.innerHTML = html;
  root.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.cat;
      renderFilters();
      render();
    });
  });
}

// ---------- Render ----------
function render() {
  const newsEl = document.getElementById('news');
  const emptyEl = document.getElementById('empty');

  const items = activeFilter === 'all'
    ? allItems
    : allItems.filter(i => i.category === activeFilter);

  if (!items.length) {
    newsEl.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }
  emptyEl.classList.add('hidden');

  newsEl.innerHTML = items.map(renderCard).join('');
}

function renderCard(item) {
  const cat = CATEGORIES[item.category] || { label: item.category, color: 'neutral' };
  const badgeColor = {
    amber:   'bg-amber-100 text-amber-900',
    violet:  'bg-violet-100 text-violet-900',
    sky:     'bg-sky-100 text-sky-900',
    emerald: 'bg-emerald-100 text-emerald-900',
    rose:    'bg-rose-100 text-rose-900',
    neutral: 'bg-neutral-100 text-neutral-700',
  }[cat.color];

  return `
    <article class="bg-white border border-neutral-200 rounded-xl p-5 hover:border-neutral-400 transition">
      <a href="${escapeAttr(item.link)}" target="_blank" rel="noopener" class="card-link block">
        <div class="flex flex-wrap items-center gap-2 text-xs mb-2.5">
          <span class="px-2 py-0.5 rounded-full font-medium ${badgeColor}">${cat.label}</span>
          <span class="text-neutral-500">${escapeHtml(item.source)}</span>
          <span class="text-neutral-300">•</span>
          <span class="text-neutral-500">${formatTime(item.published)}</span>
        </div>
        <h2 class="text-lg font-semibold leading-snug mb-2 text-neutral-900">${escapeHtml(item.title)}</h2>
        ${item.summary_th ? `<p class="text-neutral-700 leading-relaxed text-[15px]">${escapeHtml(item.summary_th)}</p>` : ''}
      </a>
    </article>
  `;
}

// ---------- Utils ----------
function formatTime(iso) {
  const d = new Date(iso);
  const diffMin = (Date.now() - d.getTime()) / 60000;
  if (diffMin < 60) return `${Math.round(diffMin)} นาทีที่แล้ว`;
  if (diffMin < 1440) return `${Math.round(diffMin / 60)} ชม.ที่แล้ว`;
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s ?? '';
  return div.innerHTML;
}

function escapeAttr(s) {
  return String(s ?? '').replace(/"/g, '&quot;');
}

load();
