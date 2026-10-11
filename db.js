const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

function defaultData() {
    return {
        rooms: [],
        customers: [],
        staff: [],
        expenses: [],
        seq: { customer: 0, staff: 0, expense: 0 }
    };
}

function ensureDB() {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(DB_PATH)) {
        fs.writeFileSync(DB_PATH, JSON.stringify(defaultData(), null, 2));
    }
}

function readDB() {
    ensureDB();
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    try {
        return JSON.parse(raw);
    } catch (e) {
        // corrupted file — reset to defaults rather than crash the app
        const fresh = defaultData();
        fs.writeFileSync(DB_PATH, JSON.stringify(fresh, null, 2));
        return fresh;
    }
}

function writeDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

module.exports = { readDB, writeDB };