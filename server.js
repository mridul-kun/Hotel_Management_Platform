const express = require('express');
const path = require('path');
const { readDB, writeDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function todayISO() {
    return new Date().toISOString().slice(0, 10);
}
function nights(checkin, checkout) {
    const ms = new Date(checkout || todayISO()) - new Date(checkin);
    return Math.max(1, Math.round(ms / 86400000));
}

/* ---------------- STATE ---------------- */
app.get('/api/state', (req, res) => {
    res.json(readDB());
});

/* ---------------- ROOMS ---------------- */
app.post('/api/rooms', (req, res) => {
    const db = readDB();
    const { number, type, rate, status } = req.body;
    if (!number || !String(number).trim()) {
        return res.status(400).json({ error: 'Room number is required.' });
    }
    if (db.rooms.some(r => r.number === String(number).trim())) {
        return res.status(400).json({ error: 'That room number already exists.' });
    }
    db.rooms.push({
        number: String(number).trim(),
        type: type || 'Standard',
        rate: Number(rate) || 0,
        status: status || 'vacant',
        guest: null
    });
    writeDB(db);
    res.json(db);
});

app.patch('/api/rooms/:number', (req, res) => {
    const db = readDB();
    const room = db.rooms.find(r => r.number === req.params.number);
    if (!room) return res.status(404).json({ error: 'Room not found.' });
    const { status, guest } = req.body;
    if (status) room.status = status;
    if (guest !== undefined) room.guest = guest;
    writeDB(db);
    res.json(db);
});

app.delete('/api/rooms/:number', (req, res) => {
    const db = readDB();
    const room = db.rooms.find(r => r.number === req.params.number);
    if (room && room.status === 'occupied') {
        return res.status(400).json({ error: 'Vacate the room before deleting it.' });
    }
    db.rooms = db.rooms.filter(r => r.number !== req.params.number);
    writeDB(db);
    res.json(db);
});

/* ---------------- CUSTOMERS ---------------- */
app.post('/api/customers', (req, res) => {
    const db = readDB();
    const { name, phone, room, checkin } = req.body;
    if (!name || !String(name).trim()) {
        return res.status(400).json({ error: 'Guest name is required.' });
    }
    const r = db.rooms.find(x => x.number === room);
    if (!r) return res.status(400).json({ error: 'Pick a valid room.' });
    if (r.status !== 'vacant') return res.status(400).json({ error: 'That room is not vacant.' });

    db.seq.customer += 1;
    const customer = {
        id: db.seq.customer,
        name: String(name).trim(),
        phone: phone ? String(phone).trim() : '',
        room,
        rate: r.rate,
        checkin: checkin || todayISO(),
        checkout: null,
        status: 'staying',
        bill: 0
    };
    db.customers.unshift(customer);
    r.status = 'occupied';
    r.guest = customer.name;
    writeDB(db);
    res.json(db);
});

app.post('/api/customers/:id/checkout', (req, res) => {
    const db = readDB();
    const customer = db.customers.find(c => c.id === Number(req.params.id));
    if (!customer) return res.status(404).json({ error: 'Guest not found.' });
    if (customer.status === 'out') return res.status(400).json({ error: 'Guest already checked out.' });

    const n = nights(customer.checkin, todayISO());
    customer.checkout = todayISO();
    customer.status = 'out';
    customer.bill = n * customer.rate;

    const room = db.rooms.find(r => r.number === customer.room);
    if (room) {
        room.status = 'vacant';
        room.guest = null;
    }
    writeDB(db);
    res.json(db);
});

/* ---------------- STAFF ---------------- */
app.post('/api/staff', (req, res) => {
    const db = readDB();
    const { name, role, shift, phone, salary } = req.body;
    if (!name || !String(name).trim()) {
        return res.status(400).json({ error: 'Staff name is required.' });
    }
    db.seq.staff += 1;
    db.staff.unshift({
        id: db.seq.staff,
        name: String(name).trim(),
        role: role || 'Staff',
        shift: shift || 'Morning',
        phone: phone ? String(phone).trim() : '',
        salary: Number(salary) || 0
    });
    writeDB(db);
    res.json(db);
});

app.delete('/api/staff/:id', (req, res) => {
    const db = readDB();
    db.staff = db.staff.filter(s => s.id !== Number(req.params.id));
    writeDB(db);
    res.json(db);
});

/* ---------------- EXPENSES ---------------- */
app.post('/api/expenses', (req, res) => {
    const db = readDB();
    const { category, desc, amount, date } = req.body;
    if (!desc || !String(desc).trim() || !amount || Number(amount) <= 0) {
        return res.status(400).json({ error: 'Description and a positive amount are required.' });
    }
    db.seq.expense += 1;
    db.expenses.unshift({
        id: db.seq.expense,
        category: category || 'Other',
        desc: String(desc).trim(),
        amount: Number(amount),
        date: date || todayISO()
    });
    writeDB(db);
    res.json(db);
});

app.delete('/api/expenses/:id', (req, res) => {
    const db = readDB();
    db.expenses = db.expenses.filter(e => e.id !== Number(req.params.id));
    writeDB(db);
    res.json(db);
});

app.listen(PORT, () => {
    console.log(`Antique Pages Hotel running at http://localhost:${PORT}`);
});