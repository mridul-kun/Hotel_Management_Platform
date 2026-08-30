/* ---------------------------------------------------------
   STATE  — mirrors what's stored server-side in data/db.json
--------------------------------------------------------- */
let state = { rooms: [], customers: [], staff: [], expenses: [] };

const $ = sel => document.querySelector(sel);
const fmt = n => '₹' + Number(n || 0).toLocaleString('en-IN');
const todayISO = () => new Date().toISOString().slice(0, 10);
const nights = (a, b) => Math.max(1, Math.round((new Date(b || todayISO()) - new Date(a)) / 86400000));
const CATS = ['Electricity', 'Decoration', 'Interior', 'Exterior', 'Customer', 'Other'];

async function api(url, options) {
    const res = await fetch(url, options && {
        ...options,
        headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Something went wrong.');
    return data;
}

async function loadState() {
    try {
        state = await api('/api/state');
        renderAll();
    } catch (e) {
        document.body.innerHTML = `<div style="padding:40px;font-family:sans-serif;color:#57333E;">
      Could not reach the server. Make sure it's running (<code>npm start</code>) and refresh this page.
    </div>`;
    }
}

function setToday() {
    const d = new Date();
    const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    $('#today').textContent = d.toLocaleDateString('en-IN', opts);
}

/* ---------------------------------------------------------
   LOGO / APP NAME → REFRESH
   (only the logo mark and the app name text are clickable —
   not the empty space around/between them)
--------------------------------------------------------- */
document.querySelectorAll('.brand-mark, .brand-name-text').forEach(el => {
    el.addEventListener('click', e => {
        // Don't refresh when the click was on the sidebar-toggle button
        // (it overlays the brand-mark when the sidebar is collapsed)
        if (e.target.closest('.sidebar-toggle')) return;
        window.location.reload();
    });
});

/* ---------------------------------------------------------
   SIDEBAR TOGGLE
--------------------------------------------------------- */
const sidebarToggleBtn = $('#sidebar-toggle');
const sidebarEl = document.querySelector('.sidebar');
sidebarToggleBtn.addEventListener('click', e => {
    e.stopPropagation(); // keep this from bubbling up to the .brand refresh handler
    const collapsed = sidebarEl.classList.toggle('collapsed');
    sidebarToggleBtn.setAttribute('aria-expanded', String(!collapsed));
});

/* ---------------------------------------------------------
   SETTINGS — sub-navigation between Profile / General /
   Data control / Privacy / Notifications
--------------------------------------------------------- */
document.querySelectorAll('.settings-navitem').forEach(item => {
    item.addEventListener('click', () => {
        document.querySelectorAll('.settings-navitem').forEach(i => i.classList.toggle('active', i === item));
        document.querySelectorAll('.settings-subpanel').forEach(p => p.classList.remove('active'));
        $('#settings-' + item.dataset.setting).classList.add('active');
    });
});

/* ---- Profile (stored locally in this browser) ---- */
const PROFILE_KEY = 'apHotel.profile';

function loadProfile() {
    let profile = {};
    try { profile = JSON.parse(localStorage.getItem(PROFILE_KEY)) || {}; } catch (e) { profile = {}; }
    $('#prof-name').value = profile.name || '';
    $('#prof-nickname').value = profile.nickname || '';
    $('#prof-mobile').value = profile.mobile || '';
    $('#prof-email').value = profile.email || '';
    renderProfileAvatar(profile);
}

function renderProfileAvatar(profile) {
    const avatar = $('#profile-avatar');
    if (profile.photo) {
        avatar.innerHTML = `<img src="${profile.photo}" alt="Profile photo">`;
    } else {
        avatar.textContent = initials(profile.nickname || profile.name || 'U');
    }
}

$('#prof-save').addEventListener('click', () => {
    let profile = {};
    try { profile = JSON.parse(localStorage.getItem(PROFILE_KEY)) || {}; } catch (e) { profile = {}; }
    profile.name = $('#prof-name').value.trim();
    profile.nickname = $('#prof-nickname').value.trim();
    profile.mobile = $('#prof-mobile').value.trim();
    profile.email = $('#prof-email').value.trim();
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    renderProfileAvatar(profile);
    alert('Profile saved.');
});

$('#profile-photo-btn').addEventListener('click', () => $('#profile-photo-input').click());
$('#profile-photo-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        let profile = {};
        try { profile = JSON.parse(localStorage.getItem(PROFILE_KEY)) || {}; } catch (err) { profile = {}; }
        profile.photo = reader.result;
        localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
        renderProfileAvatar(profile);
    };
    reader.readAsDataURL(file);
});
$('#profile-photo-remove').addEventListener('click', () => {
    let profile = {};
    try { profile = JSON.parse(localStorage.getItem(PROFILE_KEY)) || {}; } catch (e) { profile = {}; }
    delete profile.photo;
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    renderProfileAvatar(profile);
});

/* ---- General (property setup, stored locally) ---- */
const GENERAL_KEY = 'apHotel.general';

function loadGeneral() {
    let general = {};
    try { general = JSON.parse(localStorage.getItem(GENERAL_KEY)) || {}; } catch (e) { general = {}; }
    $('#gen-property-name').value = general.propertyName || 'Antique Pages';
    $('#gen-tagline').value = general.tagline || 'Hotel & Estate';
    $('#gen-currency').value = general.currency || '₹';
    $('#gen-total-rooms').value = general.totalRooms ?? '';
    $('#gen-total-staff').value = general.totalStaff ?? '';
    applyGeneral(general);
}

function applyGeneral(general) {
    if (!general.propertyName && !general.tagline) return;
    document.querySelectorAll('.brand-name-text').forEach(el => el.textContent = general.propertyName || 'Antique Pages');
    document.querySelectorAll('.brand-sub').forEach(el => el.textContent = general.tagline || 'Hotel & Estate');
    document.title = (general.propertyName || 'Antique Pages') + ' — Management';
}

$('#gen-save').addEventListener('click', () => {
    const general = {
        propertyName: $('#gen-property-name').value.trim() || 'Antique Pages',
        tagline: $('#gen-tagline').value.trim() || 'Hotel & Estate',
        currency: $('#gen-currency').value.trim() || '₹',
        totalRooms: $('#gen-total-rooms').value ? Number($('#gen-total-rooms').value) : null,
        totalStaff: $('#gen-total-staff').value ? Number($('#gen-total-staff').value) : null,
    };
    localStorage.setItem(GENERAL_KEY, JSON.stringify(general));
    applyGeneral(general);
    alert('General settings saved.');
});

/* ---- Data control ---- */
document.querySelectorAll('[data-goto]').forEach(btn => {
    btn.addEventListener('click', () => goToTab(btn.dataset.goto));
});

async function deleteAllData() {
    if (!confirm('This will permanently delete every room, guest, staff member and expense. Continue?')) return;
    if (!confirm('Are you absolutely sure? This cannot be undone.')) return;

    const jobs = [
        ...state.rooms.map(r => api(`/api/rooms/${encodeURIComponent(r.number)}`, { method: 'DELETE' }).catch(() => null)),
        ...state.customers.map(c => api(`/api/customers/${c.id}`, { method: 'DELETE' }).catch(() => null)),
        ...state.staff.map(s => api(`/api/staff/${s.id}`, { method: 'DELETE' }).catch(() => null)),
        ...state.expenses.map(e => api(`/api/expenses/${e.id}`, { method: 'DELETE' }).catch(() => null)),
    ];
    await Promise.all(jobs);
    await loadState();
    alert('All data has been deleted.');
}
$('#data-delete-all').addEventListener('click', deleteAllData);

/* ---- Privacy: local app password ---- */
const PW_KEY = 'apHotel.pwHash';

async function sha256Hex(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function renderPwStatus() {
    const hasPw = !!localStorage.getItem(PW_KEY);
    $('#pw-status').innerHTML = hasPw
        ? '<span class="on">Password protection is ON</span> for this browser.'
        : '<span class="off">Password protection is OFF.</span> Set one below.';
}

$('#pw-save').addEventListener('click', async () => {
    const pw = $('#pw-new').value;
    const confirmPw = $('#pw-confirm').value;
    if (pw.length < 4) { alert('Use at least 4 characters.'); return; }
    if (pw !== confirmPw) { alert('Passwords do not match.'); return; }
    localStorage.setItem(PW_KEY, await sha256Hex(pw));
    $('#pw-new').value = ''; $('#pw-confirm').value = '';
    renderPwStatus();
    alert('Password saved.');
});

$('#pw-remove').addEventListener('click', () => {
    localStorage.removeItem(PW_KEY);
    renderPwStatus();
});

/* ---- Privacy: sessions ---- */
$('#privacy-signout-device').addEventListener('click', () => {
    signOut();
    alert('Signed out from this device.');
});

$('#privacy-signout-all').addEventListener('click', () => {
    if (!confirm('Sign out from all devices? You will need to log in again everywhere.')) return;
    // NOTE: without a server-side session store, this can only end the
    // session on THIS device. Wiring this to every device requires a
    // backend that can invalidate sessions/tokens by user ID.
    signOut();
    alert('Signed out from this device. Other devices will need a server-side session store to be fully signed out too.');
});

/* ---- Notifications ---- */
const NOTIF_KEY = 'apHotel.notifications';
const NOTIF_OPTIONS = [
    { id: 'checkins', label: 'New guest check-ins', sub: 'When a guest is checked into a room' },
    { id: 'checkouts', label: 'Guest check-outs', sub: 'When a guest checks out and a bill is closed' },
    { id: 'lowVacancy', label: 'Low room availability', sub: 'When vacant rooms run low' },
    { id: 'maintenance', label: 'Maintenance alerts', sub: 'When a room is marked for maintenance' },
    { id: 'expenses', label: 'New expense logged', sub: 'Every time an expense entry is added' },
    { id: 'staffChanges', label: 'Staff added or removed', sub: 'Roster changes' },
    { id: 'dailySummary', label: 'Daily summary', sub: 'A daily recap of occupancy and spend' },
];

function loadNotifPrefs() {
    let prefs = {};
    try { prefs = JSON.parse(localStorage.getItem(NOTIF_KEY)) || {}; } catch (e) { prefs = {}; }
    return prefs;
}

function renderNotifications() {
    const prefs = loadNotifPrefs();
    $('#notif-list').innerHTML = NOTIF_OPTIONS.map(o => `
    <div class="notif-row">
      <div>
        <div class="notif-label">${o.label}</div>
        <div class="notif-sub">${o.sub}</div>
      </div>
      <label class="switch">
        <input type="checkbox" data-notif="${o.id}" ${prefs[o.id] !== false ? 'checked' : ''}>
        <span class="slider"></span>
      </label>
    </div>`).join('');

    document.querySelectorAll('[data-notif]').forEach(input => {
        input.addEventListener('change', () => {
            const prefs = loadNotifPrefs();
            prefs[input.dataset.notif] = input.checked;
            localStorage.setItem(NOTIF_KEY, JSON.stringify(prefs));
        });
    });
}

/* ---- init settings on load ---- */
loadProfile();
loadGeneral();
renderPwStatus();
renderNotifications();

/* ---------------------------------------------------------
   NAVIGATION  (sidebar nav + mobile full-screen nav stay in sync)
--------------------------------------------------------- */
function goToTab(tab) {
    document.querySelectorAll('.navlink').forEach(l => l.classList.toggle('active', l.dataset.tab === tab));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    $('#tab-' + tab).classList.add('active');
}

document.querySelectorAll('.navlink').forEach(link => {
    link.addEventListener('click', () => {
        goToTab(link.dataset.tab);
        closeMobileMenu();
    });
});

/* ---------------------------------------------------------
   MOBILE BURGER MENU
--------------------------------------------------------- */
const burgerBtn = $('#burger-btn');
const mobileMenu = $('#mobile-menu');
const mobileMenuClose = $('#mobile-menu-close');

function openMobileMenu() {
    mobileMenu.classList.add('open');
    burgerBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
}
function closeMobileMenu() {
    mobileMenu.classList.remove('open');
    burgerBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
}

burgerBtn.addEventListener('click', openMobileMenu);
mobileMenuClose.addEventListener('click', closeMobileMenu);
mobileMenu.addEventListener('click', e => { if (e.target === mobileMenu) closeMobileMenu(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMobileMenu(); });

/* ---------------------------------------------------------
   PANEL TOGGLES
--------------------------------------------------------- */
let editRoomNumber = null;
let editCustomerId = null;
let editStaffId = null;
let editExpenseId = null;

function togglePanel(btnId, panelId, onOpen) {
    $(btnId).addEventListener('click', () => {
        const p = $(panelId);
        p.classList.toggle('open');
        if (p.classList.contains('open') && onOpen) onOpen();
    });
}
togglePanel('#btn-add-room', '#panel-room', () => {
    editRoomNumber = null;
    $('#rm-number').disabled = false;
    $('#rm-status').disabled = false;
    $('#panel-room h3').textContent = 'Add a room';
    $('#rm-save').textContent = 'Save room';
    $('#rm-number').value = ''; $('#rm-rate').value = ''; $('#rm-type').value = 'Standard'; $('#rm-status').value = 'vacant';
});
togglePanel('#btn-add-guest', '#panel-guest', () => {
    editCustomerId = null;
    $('#panel-guest h3').textContent = 'Check in a guest';
    $('#gs-save').textContent = 'Check in';
    $('#gs-name').value = ''; $('#gs-phone').value = '';
    fillRoomSelect();
});
togglePanel('#btn-add-staff', '#panel-staff', () => {
    editStaffId = null;
    $('#panel-staff h3').textContent = 'Add a staff member';
    $('#st-save').textContent = 'Save staff';
    $('#st-name').value = ''; $('#st-phone').value = ''; $('#st-salary').value = '';
});
togglePanel('#btn-add-expense', '#panel-expense', () => {
    editExpenseId = null;
    $('#panel-expense h3').textContent = 'Log an expense';
    $('#ex-save').textContent = 'Save expense';
    $('#ex-desc').value = ''; $('#ex-amt').value = '';
    $('#ex-date').value = todayISO();
});

function closeRoomPanel() {
    $('#panel-room').classList.remove('open');
    $('#panel-room h3').textContent = 'Add a room';
    $('#rm-save').textContent = 'Save room';
    $('#rm-number').value = ''; $('#rm-rate').value = '';
    $('#rm-number').disabled = false;
    $('#rm-status').disabled = false;
    editRoomNumber = null;
}
function closeGuestPanel() {
    $('#panel-guest').classList.remove('open');
    $('#panel-guest h3').textContent = 'Check in a guest';
    $('#gs-save').textContent = 'Check in';
    $('#gs-name').value = ''; $('#gs-phone').value = '';
    editCustomerId = null;
}
function closeStaffPanel() {
    $('#panel-staff').classList.remove('open');
    $('#panel-staff h3').textContent = 'Add a staff member';
    $('#st-save').textContent = 'Save staff';
    $('#st-name').value = ''; $('#st-phone').value = ''; $('#st-salary').value = '';
    editStaffId = null;
}
function closeExpensePanel() {
    $('#panel-expense').classList.remove('open');
    $('#panel-expense h3').textContent = 'Log an expense';
    $('#ex-save').textContent = 'Save expense';
    $('#ex-desc').value = ''; $('#ex-amt').value = '';
    editExpenseId = null;
}
$('#rm-cancel').onclick = closeRoomPanel;
$('#gs-cancel').onclick = closeGuestPanel;
$('#st-cancel').onclick = closeStaffPanel;
$('#ex-cancel').onclick = closeExpensePanel;

/* ---------------------------------------------------------
   "MORE OPTIONS" — shared Edit/Delete dropdown for every
   room / customer / staff / expense entry
--------------------------------------------------------- */
let moreMenuTarget = null; // { type, id }

function openMoreMenu(e, type, id) {
    e.stopPropagation();
    const menu = $('#more-menu');
    const btnRect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 150;
    let left = btnRect.right - menuWidth;
    if (left < 8) left = 8;
    menu.style.top = (btnRect.bottom + 6) + 'px';
    menu.style.left = left + 'px';
    menu.classList.add('open');
    moreMenuTarget = { type, id };
}

function closeMoreMenu() {
    $('#more-menu').classList.remove('open');
    moreMenuTarget = null;
}

document.addEventListener('click', closeMoreMenu);
document.addEventListener('scroll', closeMoreMenu, true);
$('#more-menu').addEventListener('click', e => e.stopPropagation());

$('#more-menu [data-action="edit"]').addEventListener('click', () => {
    if (!moreMenuTarget) return;
    const { type, id } = moreMenuTarget;
    closeMoreMenu();
    if (type === 'room') editRoom(id);
    else if (type === 'customer') editCustomer(id);
    else if (type === 'staff') editStaff(id);
    else if (type === 'expense') editExpense(id);
});

$('#more-menu [data-action="delete"]').addEventListener('click', () => {
    if (!moreMenuTarget) return;
    const { type, id } = moreMenuTarget;
    closeMoreMenu();
    deleteEntry(type, id);
});

async function deleteEntry(type, id) {
    if (!confirm(`Delete this ${type}? This can't be undone.`)) return;
    try {
        if (type === 'room') {
            state = await api(`/api/rooms/${encodeURIComponent(id)}`, { method: 'DELETE' });
            renderAll();
        } else if (type === 'customer') {
            state = await api(`/api/customers/${id}`, { method: 'DELETE' });
            renderAll();
        } else if (type === 'staff') {
            await removeStaff(id); // already calls renderAll()
        } else if (type === 'expense') {
            await removeExpense(id); // already calls renderAll()
        }
    } catch (e) { alert(e.message); }
}

/* ---------------------------------------------------------
   ROOMS
--------------------------------------------------------- */
$('#rm-save').onclick = async () => {
    const number = $('#rm-number').value.trim();
    const rate = Number($('#rm-rate').value) || 0;
    if (!number) { alert('Enter a room number.'); return; }
    try {
        if (editRoomNumber) {
            const body = { type: $('#rm-type').value, rate };
            if (!$('#rm-status').disabled) body.status = $('#rm-status').value;
            state = await api(`/api/rooms/${encodeURIComponent(editRoomNumber)}`, { method: 'PATCH', body: JSON.stringify(body) });
        } else {
            state = await api('/api/rooms', {
                method: 'POST',
                body: JSON.stringify({ number, type: $('#rm-type').value, rate, status: $('#rm-status').value })
            });
        }
        closeRoomPanel();
        renderAll();
    } catch (e) { alert(e.message); }
};

function editRoom(number) {
    const r = state.rooms.find(x => x.number === number);
    if (!r) return;
    editRoomNumber = number;
    $('#panel-room h3').textContent = 'Edit room ' + r.number;
    $('#rm-save').textContent = 'Update room';
    $('#rm-number').value = r.number;
    $('#rm-number').disabled = true; // the room number is its identifier — not renameable here
    $('#rm-type').value = r.type;
    $('#rm-rate').value = r.rate;
    if (r.status === 'occupied') {
        // an occupied room's status shouldn't be changed from this form —
        // use the Vacate / Maintenance buttons on the card for that instead
        $('#rm-status').disabled = true;
    } else {
        $('#rm-status').value = r.status;
        $('#rm-status').disabled = false;
    }
    $('#panel-room').classList.add('open');
}

async function roomAction(number, action) {
    let body = {};
    if (action === 'vacate') body = { status: 'vacant', guest: null };
    else if (action === 'maintenance') body = { status: 'maintenance', guest: null };
    else if (action === 'activate') body = { status: 'vacant' };
    try {
        state = await api(`/api/rooms/${encodeURIComponent(number)}`, { method: 'PATCH', body: JSON.stringify(body) });
        renderAll();
    } catch (e) { alert(e.message); }
}

function roomCard(r) {
    return `
  <div class="room-card">
    <div class="perf"></div>
    <div class="room-card-head">
      <div class="num">${r.number}</div>
      <button type="button" class="more-btn" onclick="openMoreMenu(event,'room','${r.number}')" aria-label="More options">⋮</button>
    </div>
    <div class="type">${r.type}</div>
    <span class="badge ${r.status}">${r.status}</span>
    <div class="guest">${r.guest ? '👤 ' + r.guest : '&nbsp;'}</div>
    <div class="rate">${fmt(r.rate)} / night</div>
    <div class="actions">
      ${r.status === 'occupied'
            ? `<button class="btn small danger" onclick="roomAction('${r.number}','vacate')">Vacate</button>`
            : r.status === 'maintenance'
                ? `<button class="btn small secondary" onclick="roomAction('${r.number}','activate')">Mark ready</button>`
                : `<button class="btn small secondary" onclick="roomAction('${r.number}','maintenance')">Maintenance</button>`
        }
    </div>
  </div>`;
}

function renderRooms() {
    const vacant = state.rooms.filter(r => r.status === 'vacant').length;
    const occupied = state.rooms.filter(r => r.status === 'occupied').length;

    $('#rooms-count').textContent = state.rooms.length + ' total';
    $('#rooms-stats').innerHTML = `
    ${statTile('Vacant rooms', vacant)}
    ${statTile('Occupied rooms', occupied)}
    ${statTile('Total rooms', state.rooms.length)}
  `;
    $('#rooms-grid').innerHTML = state.rooms.map(roomCard).join('');
    $('#dash-room-count').textContent = state.rooms.length + ' total';
    $('#dash-room-preview').innerHTML = state.rooms.slice(0, 4).map(roomCard).join('');
}

function fillRoomSelect(includeRoomNumber) {
    const vacant = state.rooms.filter(r => r.status === 'vacant' || r.number === includeRoomNumber);
    $('#gs-room').innerHTML = vacant.length
        ? vacant.map(r => `<option value="${r.number}">${r.number} — ${r.type} (${fmt(r.rate)})</option>`).join('')
        : `<option value="">No vacant rooms</option>`;
    if (!includeRoomNumber) $('#gs-date').value = todayISO();
}

/* ---------------------------------------------------------
   CUSTOMERS
--------------------------------------------------------- */
$('#gs-save').onclick = async () => {
    const name = $('#gs-name').value.trim();
    const room = $('#gs-room').value;
    if (!name || !room) { alert('Enter a guest name and pick a room.'); return; }
    const payload = { name, phone: $('#gs-phone').value.trim(), room, checkin: $('#gs-date').value };
    try {
        if (editCustomerId) {
            // No update endpoint is confirmed on the server, so the record
            // is recreated with the edited details. Delete-then-recreate is
            // only safe for guests still staying — see editCustomer() below.
            await api(`/api/customers/${editCustomerId}`, { method: 'DELETE' });
            state = await api('/api/customers', { method: 'POST', body: JSON.stringify(payload) });
        } else {
            state = await api('/api/customers', { method: 'POST', body: JSON.stringify(payload) });
        }
        closeGuestPanel();
        renderAll();
    } catch (e) { alert(e.message); }
};

function editCustomer(id) {
    const c = state.customers.find(x => x.id === id);
    if (!c) return;
    if (c.status !== 'staying') {
        alert('Editing is only available for guests who are still staying. Delete and check in again if you need to change a past stay.');
        return;
    }
    editCustomerId = id;
    $('#panel-guest h3').textContent = 'Edit guest';
    $('#gs-save').textContent = 'Update guest';
    $('#gs-name').value = c.name;
    $('#gs-phone').value = c.phone || '';
    fillRoomSelect(c.room);
    $('#gs-room').value = c.room;
    $('#gs-date').value = c.checkin;
    $('#panel-guest').classList.add('open');
}

async function checkoutGuest(id) {
    try {
        state = await api(`/api/customers/${id}/checkout`, { method: 'POST' });
        renderAll();
    } catch (e) { alert(e.message); }
}

function renderCustomers() {
    const staying = state.customers.filter(c => c.status === 'staying');
    const revenue = state.customers.reduce((s, c) => s + (c.status === 'out' ? c.bill : nights(c.checkin, todayISO()) * c.rate), 0);

    $('#cust-count').textContent = state.customers.length + ' guests on record';
    $('#cust-stats').innerHTML = `
    ${statTile('Currently staying', staying.length)}
    ${statTile('Total guests on record', state.customers.length)}
    ${statTile('Est. revenue to date', fmt(revenue))}
  `;

    $('#cust-table').innerHTML = state.customers.length ? state.customers.map(c => `
    <tr>
      <td><b>${c.name}</b></td>
      <td class="mono">${c.phone || '—'}</td>
      <td class="mono">${c.room}</td>
      <td class="mono">${c.checkin}</td>
      <td class="mono">${c.checkout || '—'}</td>
      <td><span class="status-dot ${c.status === 'staying' ? 'staying' : 'out'}">${c.status === 'staying' ? 'Staying' : 'Checked out'}</span></td>
      <td class="mono">${c.status === 'out' ? fmt(c.bill) : fmt(nights(c.checkin, todayISO()) * c.rate) + ' *'}</td>
      <td>
        <div style="display:flex;gap:6px;align-items:center;justify-content:flex-end;">
          ${c.status === 'staying' ? `<button class="btn small teal" onclick="checkoutGuest(${c.id})">Check out</button>` : ''}
          <button type="button" class="more-btn" onclick="openMoreMenu(event,'customer',${c.id})" aria-label="More options">⋮</button>
        </div>
      </td>
    </tr>`).join('') : `<tr><td colspan="8" class="empty">No guests yet — check one in above.</td></tr>`;
}

/* ---------------------------------------------------------
   STAFF
--------------------------------------------------------- */
$('#st-save').onclick = async () => {
    const name = $('#st-name').value.trim();
    if (!name) { alert('Enter a staff name.'); return; }
    const payload = {
        name, role: $('#st-role').value, shift: $('#st-shift').value,
        phone: $('#st-phone').value.trim(), salary: Number($('#st-salary').value) || 0
    };
    try {
        if (editStaffId) {
            await api(`/api/staff/${editStaffId}`, { method: 'DELETE' });
            state = await api('/api/staff', { method: 'POST', body: JSON.stringify(payload) });
        } else {
            state = await api('/api/staff', { method: 'POST', body: JSON.stringify(payload) });
        }
        closeStaffPanel();
        renderAll();
    } catch (e) { alert(e.message); }
};

function editStaff(id) {
    const s = state.staff.find(x => x.id === id);
    if (!s) return;
    editStaffId = id;
    $('#panel-staff h3').textContent = 'Edit staff member';
    $('#st-save').textContent = 'Update staff';
    $('#st-name').value = s.name;
    $('#st-role').value = s.role;
    $('#st-shift').value = s.shift;
    $('#st-phone').value = s.phone || '';
    $('#st-salary').value = s.salary;
    $('#panel-staff').classList.add('open');
}

async function removeStaff(id) {
    try {
        state = await api(`/api/staff/${id}`, { method: 'DELETE' });
        renderAll();
    } catch (e) { alert(e.message); }
}

function renderStaff() {
    const payroll = state.staff.reduce((s, m) => s + (m.salary || 0), 0);
    const roles = new Set(state.staff.map(s => s.role)).size;

    $('#staff-count').textContent = state.staff.length + ' on roster';
    $('#staff-stats').innerHTML = `
    ${statTile('Total staff', state.staff.length)}
    ${statTile('Monthly payroll', fmt(payroll))}
    ${statTile('Roles covered', roles)}
  `;
    $('#staff-grid').innerHTML = state.staff.length ? state.staff.map(s => `
    <div class="staff-card">
      <div class="staff-card-head">
        <div class="name">${s.name}</div>
        <button type="button" class="more-btn" onclick="openMoreMenu(event,'staff',${s.id})" aria-label="More options">⋮</button>
      </div>
      <div class="role">${s.role}</div>
      <div class="line"><span>Shift</span><b>${s.shift}</b></div>
      <div class="line"><span>Phone</span><b class="mono">${s.phone || '—'}</b></div>
      <div class="line"><span>Salary / mo</span><b class="mono">${fmt(s.salary)}</b></div>
    </div>`).join('') : `<div class="empty">No staff added yet.</div>`;
}

/* ---------------------------------------------------------
   EXPENSES
--------------------------------------------------------- */
$('#ex-save').onclick = async () => {
    const amount = Number($('#ex-amt').value) || 0;
    const desc = $('#ex-desc').value.trim();
    if (!desc || amount <= 0) { alert('Enter a description and an amount.'); return; }
    const payload = { category: $('#ex-cat').value, desc, amount, date: $('#ex-date').value };
    try {
        if (editExpenseId) {
            await api(`/api/expenses/${editExpenseId}`, { method: 'DELETE' });
            state = await api('/api/expenses', { method: 'POST', body: JSON.stringify(payload) });
        } else {
            state = await api('/api/expenses', { method: 'POST', body: JSON.stringify(payload) });
        }
        closeExpensePanel();
        renderAll();
    } catch (e) { alert(e.message); }
};

function editExpense(id) {
    const e = state.expenses.find(x => x.id === id);
    if (!e) return;
    editExpenseId = id;
    $('#panel-expense h3').textContent = 'Edit expense';
    $('#ex-save').textContent = 'Update expense';
    $('#ex-cat').value = e.category;
    $('#ex-desc').value = e.desc;
    $('#ex-amt').value = e.amount;
    $('#ex-date').value = e.date;
    $('#panel-expense').classList.add('open');
}

async function removeExpense(id) {
    try {
        state = await api(`/api/expenses/${id}`, { method: 'DELETE' });
        renderAll();
    } catch (e) { alert(e.message); }
}

function catTotals() {
    const t = {}; CATS.forEach(c => t[c] = 0);
    state.expenses.forEach(e => t[e.category] = (t[e.category] || 0) + e.amount);
    return t;
}

function renderExpenses() {
    const totals = catTotals();
    const grand = Object.values(totals).reduce((a, b) => a + b, 0);
    const max = Math.max(...Object.values(totals), 1);

    $('#exp-count').textContent = state.expenses.length + ' entries';
    $('#exp-stats').innerHTML = `
    ${statTile('Total logged', fmt(grand))}
    ${statTile('Electricity', fmt(totals.Electricity))}
    ${statTile('Decoration + Interior', fmt(totals.Decoration + totals.Interior))}
    ${statTile('Exterior', fmt(totals.Exterior))}
  `;

    $('#exp-table').innerHTML = state.expenses.length ? state.expenses.map(e => `
    <tr>
      <td class="mono">${e.date}</td>
      <td><span class="cat-pill cat-${e.category}">${e.category}</span></td>
      <td>${e.desc}</td>
      <td class="mono">${fmt(e.amount)}</td>
      <td><button type="button" class="more-btn" onclick="openMoreMenu(event,'expense',${e.id})" aria-label="More options">⋮</button></td>
    </tr>`).join('') : `<tr><td colspan="5" class="empty">No expenses logged yet.</td></tr>`;

    $('#dash-breakdown').innerHTML = CATS.map(c => `
    <div class="bd-row">
      <span class="cat-pill cat-${c}">${c}</span>
      <div class="bd-track"><div class="bd-fill" style="width:${(totals[c] / max * 100)}%;"></div></div>
      <div class="bd-amt">${fmt(totals[c])}</div>
    </div>`).join('');
    $('#dash-exp-total').textContent = fmt(grand) + ' total';
}

/* ---------------------------------------------------------
   DASHBOARD
--------------------------------------------------------- */
function statTile(label, value, sub) {
    return `<div class="stat"><div class="label">${label}</div><div class="value">${value}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`;
}

function renderDashboard() {
    const occupied = state.rooms.filter(r => r.status === 'occupied').length;
    const vacant = state.rooms.filter(r => r.status === 'vacant').length;
    const staying = state.customers.filter(c => c.status === 'staying').length;
    const grandExpense = state.expenses.reduce((s, e) => s + e.amount, 0);
    const occPct = state.rooms.length ? Math.round(occupied / state.rooms.length * 100) : 0;

    $('#dash-stats').innerHTML = `
    ${statTile('Rooms occupied', occupied + ' <small>/ ' + state.rooms.length + '</small>', occPct + '% occupancy')}
    ${statTile('Vacant rooms', vacant)}
    ${statTile('Guests staying', staying)}
    ${statTile('Staff on roster', state.staff.length)}
    ${statTile('Total guests on record', state.customers.length)}
    ${statTile('Total expenses logged', fmt(grandExpense))}
  `;
}

/* ---------------------------------------------------------
   RENDER ALL
--------------------------------------------------------- */
function renderAll() {
    renderRooms();
    renderCustomers();
    renderStaff();
    renderExpenses();
    renderDashboard();
    fillRoomSelect();
}

setToday();
loadState();
setInterval(setToday, 30000);

let authUser = null;
let pendingOtp = null;
let pendingLogin = null;
const loginOverlay = $('#login-overlay');

function openLogin() {
    closeMobileMenu();
    resetLoginForm();
    loginOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
}
function closeLogin() {
    loginOverlay.classList.remove('open');
    document.body.style.overflow = '';
}
$('#login-close').addEventListener('click', closeLogin);
loginOverlay.addEventListener('click', e => { if (e.target === loginOverlay) closeLogin(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLogin(); });

function resetLoginForm() {
    $('#login-form-mobile').style.display = 'block';
    $('#login-form-email').style.display = 'none';
    $('#login-otp-step').style.display = 'none';
    document.querySelectorAll('.login-tab').forEach(t => t.classList.toggle('active', t.dataset.method === 'mobile'));
    $('#login-mobile').value = ''; $('#login-email').value = '';
    $('#login-password').value = ''; $('#login-otp').value = '';
    hideLoginError();
    pendingOtp = null; pendingLogin = null;
}

document.querySelectorAll('.login-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const method = tab.dataset.method;
        $('#login-form-mobile').style.display = method === 'mobile' ? 'block' : 'none';
        $('#login-form-email').style.display = method === 'email' ? 'block' : 'none';
        $('#login-otp-step').style.display = 'none';
        hideLoginError();
    });
});

function showLoginError(msg) { const el = $('#login-error'); el.textContent = msg; el.classList.add('show'); }
function hideLoginError() { $('#login-error').classList.remove('show'); }

$('#login-form-mobile').addEventListener('submit', e => {
    e.preventDefault();
    const num = $('#login-mobile').value.trim();
    if (!/^\d{10}$/.test(num)) { showLoginError('Enter a valid 10-digit mobile number.'); return; }
    hideLoginError();
    pendingOtp = String(Math.floor(100000 + Math.random() * 900000));
    pendingLogin = { method: 'mobile', identifier: '+91 ' + num };
    console.log('Mock OTP (replace with real SMS provider):', pendingOtp);
    $('#otp-target').textContent = '+91 ' + num;
    $('#login-form-mobile').style.display = 'none';
    $('#login-otp-step').style.display = 'block';
    $('#login-otp').focus();
});

$('#login-otp-back').addEventListener('click', () => {
    $('#login-otp-step').style.display = 'none';
    $('#login-form-mobile').style.display = 'block';
    hideLoginError();
});

$('#login-otp-submit').addEventListener('click', () => {
    const code = $('#login-otp').value.trim();
    if (code.length !== 6) { showLoginError('Enter the 6-digit code.'); return; }
    if (code !== pendingOtp) { showLoginError('That code is incorrect.'); return; }
    signIn(pendingLogin);
});

$('#login-form-email').addEventListener('submit', e => {
    e.preventDefault();
    const email = $('#login-email').value.trim();
    const password = $('#login-password').value;
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email)) { showLoginError('Enter a valid email address.'); return; }
    if (!password) { showLoginError('Enter your password.'); return; }
    hideLoginError();
    signIn({ method: 'email', identifier: email });
});

$('#login-google').addEventListener('click', () => {
    // Mock Google sign-in — swap this for a real Google Identity Services flow
    // (see https://developers.google.com/identity/gsi/web) once you have a
    // client ID; that flow returns a real Google account email to use here.
    hideLoginError();
    signIn({ method: 'google', identifier: 'you@gmail.com' });
});

function signIn(user) { authUser = user; closeLogin(); renderAuth(); }
function signOut() { authUser = null; renderAuth(); }

function initials(str) {
    const letters = str.replace(/[^a-zA-Z ]/g, '').trim().split(' ').filter(Boolean);
    return letters.slice(0, 2).map(s => s[0].toUpperCase()).join('') || '@';
}

function authBoxMarkup(suffix) {
    if (authUser) {
        return `
      <div class="auth-user">
        <div class="auth-avatar">${authUser.method === 'mobile' ? '📱' : authUser.method === 'google' ? 'G' : initials(authUser.identifier)}</div>
        <div>
          <div class="auth-name">Signed in</div>
          <div class="auth-sub mono">${authUser.identifier}</div>
        </div>
      </div>
      <button class="btn small secondary auth-logout-btn" data-suffix="${suffix}" style="width:100%;margin-top:10px;">Log out</button>`;
    }
    return `
    <div class="auth-status"><span class="auth-dot"></span> Not signed in</div>
    <button class="btn small teal auth-login-btn" data-suffix="${suffix}" style="width:100%;margin-top:8px;">Login</button>`;
}

function renderAuth() {
    $('#auth-box').innerHTML = authBoxMarkup('desktop');
    $('#auth-box-mobile').innerHTML = authBoxMarkup('mobile');
    document.querySelectorAll('.auth-login-btn').forEach(b => b.addEventListener('click', openLogin));
    document.querySelectorAll('.auth-logout-btn').forEach(b => b.addEventListener('click', signOut));
}
renderAuth();