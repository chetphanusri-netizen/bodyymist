/* ==========================================================
   Body Scent — script.js (ใช้ร่วมกันทุกหน้า)
   - product.html : แสดงสินค้า + กรอง mood
   - order.html   : เติมฟอร์มจาก URL + ส่งออเดอร์
   - admin.html   : แสดงออเดอร์จาก Google Sheet
   ========================================================== */

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwgC0dTgyUgrkHaRN7EHJXvUJbuvMnu7JCtvQ04tIfberqVGv4Gvbj-NWqH9nLheht9yw/exec';
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQFCc657qtZIxmSRTxeQ8ENzFWHwPV-Lo10D5fsWILsoxcLvrED4JVBv9GqdIZtsvnaHPgc7Bair4ny/pub?gid=0&single=true&output=csv';

const MOODS = [
  { key: 'all',       label: 'ทั้งหมด' },
  { key: 'fresh',     label: 'Fresh' },
  { key: 'sweet',     label: 'Sweet' },
  { key: 'confident', label: 'Confident' },
  { key: 'romance',   label: 'Romance' }
];

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('product-list')) initProductPage();
  if (document.getElementById('orderForm'))    initOrderPage();
  if (document.querySelector('#ordersTable tbody')) initAdminPage();
});

/* ---------- ตัวช่วย ---------- */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatPrice(value) {
  const n = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) && String(value).trim() !== '' ? n.toLocaleString('th-TH') : String(value);
}

/* ==========================================================
   1) product.html
   ========================================================== */
async function initProductPage() {
  const list = document.getElementById('product-list');
  const bar = document.getElementById('filter-bar');
  let products = [];

  try {
    const res = await fetch('products.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    products = await res.json();
  } catch (err) {
    console.error(err);
    list.replaceChildren(el('p', 'muted', 'โหลดข้อมูลสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'));
    return;
  }

  // mood เริ่มต้นจาก ?mood=xxx (ถ้าไม่ถูกต้องให้เป็น all)
  const urlMood = (new URLSearchParams(window.location.search).get('mood') || '').toLowerCase();
  let currentMood = MOODS.some(m => m.key === urlMood) ? urlMood : 'all';

  function renderFilters() {
    if (!bar) return;
    bar.replaceChildren();
    MOODS.forEach(m => {
      const btn = el('button', 'filter');
      btn.type = 'button';
      btn.dataset.mood = m.key;
      btn.setAttribute('aria-pressed', String(m.key === currentMood));
      if (m.key === currentMood) btn.classList.add('is-active');
      if (m.key !== 'all') btn.appendChild(el('span', 'mood-dot'));
      btn.appendChild(document.createTextNode(m.label));
      btn.addEventListener('click', () => {
        currentMood = m.key;
        renderFilters();
        renderProducts();
      });
      bar.appendChild(btn);
    });
  }

  function renderProducts() {
    const shown = currentMood === 'all' ? products : products.filter(p => p.mood === currentMood);
    list.replaceChildren();
    if (!shown.length) {
      list.appendChild(el('p', 'muted', 'ไม่พบสินค้าในหมวดนี้'));
      return;
    }
    shown.forEach(p => list.appendChild(buildCard(p)));
  }

  renderFilters();
  renderProducts();
}

function buildCard(p) {
  const card = el('article', 'card');
  card.dataset.mood = p.mood;

  const media = el('div', 'card__media');
  const img = document.createElement('img');
  img.src = p.image;
  img.alt = p.name;
  img.loading = 'lazy';
  img.addEventListener('error', () => { img.style.visibility = 'hidden'; });
  media.appendChild(img);

  const body = el('div', 'card__body');
  const mood = el('span', 'mood-label');
  mood.append(el('span', 'mood-dot'), document.createTextNode(p.mood.charAt(0).toUpperCase() + p.mood.slice(1)));
  const title = el('h3', 'card__title', p.name);
  const size = el('p', 'card__meta', p.size ? p.size : (p.type === 'rollon' ? 'โรลออน' : ''));

  const foot = el('div', 'card__foot');
  const price = el('span', 'price', formatPrice(p.price));
  price.appendChild(el('small', '', 'บาท'));

  const buy = el('a', 'btn btn--accent', 'สั่งซื้อ');
  buy.href = 'order.html?item=' + encodeURIComponent(p.name) + '&price=' + encodeURIComponent(p.price);
  foot.append(price, buy);

  body.append(mood, title);
  if (size.textContent) body.appendChild(size);
  body.appendChild(foot);

  card.append(media, body);
  return card;
}

/* ==========================================================
   2) order.html
   ========================================================== */
function initOrderPage() {
  const params = new URLSearchParams(window.location.search);
  const item = params.get('item');
  const price = params.get('price');

  const itemsInput = document.getElementById('items');
  const totalInput = document.getElementById('total');

  // เติมทั้งชื่อสินค้า (#items) และราคา (#total) ทันที
  if (itemsInput && item !== null) itemsInput.value = item;
  if (totalInput && price !== null) totalInput.value = price;

  const form = document.getElementById('orderForm');
  form.addEventListener('submit', event => {
    event.preventDefault();

    const payload = {
      customerName: document.getElementById('customerName').value.trim(),
      contact: document.getElementById('contact').value.trim(),
      items: document.getElementById('items').value.trim(),
      total: document.getElementById('total').value.trim(),
      note: document.getElementById('note').value.trim()
    };

    const submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    .then(() => { window.location.href = 'thankyou.html'; })
    .catch(error => {
      console.error(error);
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      if (submitBtn) submitBtn.disabled = false;
    });
  });
}

/* ==========================================================
   3) admin.html
   ========================================================== */

// parse CSV เอง: รองรับ "..." , "" (เครื่องหมายคำพูดซ้อน), ขึ้นบรรทัดใหม่ในช่อง, CRLF, BOM
function parseCSV(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }

  // ตัดแถวว่าง
  return rows.filter(r => r.some(cell => cell.trim() !== ''));
}

async function initAdminPage() {
  const tbody = document.querySelector('#ordersTable tbody');
  const COLS = 6; // วันเวลา, ชื่อ, เบอร์/Line, รายการ, ยอดรวม, หมายเหตุ

  function message(text) {
    const tr = document.createElement('tr');
    const td = el('td', 'muted', text);
    td.colSpan = COLS;
    tr.appendChild(td);
    tbody.replaceChildren(tr);
  }

  message('กำลังโหลดข้อมูล...');

  try {
    const res = await fetch(SHEET_CSV_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const rows = parseCSV(await res.text());

    rows.shift(); // แถวแรกเป็นหัวตาราง
    if (!rows.length) { message('ยังไม่มีรายการสั่งซื้อ'); return; }

    // Sheet เพิ่มแถวใหม่ต่อท้ายเสมอ → กลับลำดับให้รายการล่าสุดอยู่บนสุด
    rows.reverse();

    tbody.replaceChildren();
    rows.forEach(r => {
      const tr = document.createElement('tr');
      for (let i = 0; i < COLS; i++) {
        let value = (r[i] || '').trim();
        if (i === 4 && value) value = formatPrice(value) + ' บาท';
        tr.appendChild(el('td', '', value));
      }
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    message('โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
  }
}
