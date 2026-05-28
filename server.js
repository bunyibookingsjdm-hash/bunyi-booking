const express = require('express');
const app = express();
const path = require('path');
const multer = require('multer');

const admin = require('firebase-admin');
try {
  const serviceAccount = {
    type: 'service_account',
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: Buffer.from(process.env.FIREBASE_PRIVATE_KEY_BASE64 || '', 'base64').toString('utf8'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
  };
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  console.log('✅ Firebase Auth connected');
} catch(e) {
  console.log('⚠️ Firebase Auth error:', e.message);
}

// ===== MONGODB =====
const { MongoClient } = require('mongodb');
let mdb;
let mongoClient;
async function connectMongo() {
  try {
    mongoClient = new MongoClient(process.env.MONGODB_URI);
    await mongoClient.connect();
    mdb = mongoClient.db('bunyi');
    console.log('✅ MongoDB connected');
  } catch(e) {
    console.log('⚠️ MongoDB error:', e.message);
  }
}

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/favicon.ico', (req, res) => res.sendFile(path.join(__dirname, 'favicon.png')));
app.get('/favicon.png', (req, res) => res.sendFile(path.join(__dirname, 'favicon.png')));

const session = require('express-session');
const {FirestoreStore} = require('@google-cloud/connect-firestore');

app.use(session({
  secret: process.env.SESSION_SECRET || 'bunyi-secret-key',
  resave: true,
  saveUninitialized: true,
  name: 'bunyi.sid'
}));

// ===== CLOUDINARY =====
const cloudinary = require('cloudinary').v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Upload file buffer to Cloudinary
async function uploadToCloudinary(fileBuffer, mimetype, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: folder || 'bunyi', resource_type: 'auto' },
      (error, result) => { if (error) reject(error); else resolve(result.secure_url); }
    );
    stream.end(fileBuffer);
  });
}

// ===== MULTER — memory storage (files go to Cloudinary, not local disk) =====
const upload = multer({ storage: multer.memoryStorage() });

async function getCollection(name) {
  try { return await mdb.collection(name).find({}).toArray(); } catch(e) { return []; }
}
async function addDoc(name, data) {
  try { const r = await mdb.collection(name).insertOne({ ...data, createdAt: new Date() }); return r.insertedId.toString(); } catch(e) { return null; }
}
async function updateDoc(name, id, data) {
  try { const { ObjectId } = require('mongodb'); await mdb.collection(name).updateOne({ _id: new ObjectId(id) }, { $set: data }); } catch(e) {}
}
async function deleteDoc(name, id) {
  try { const { ObjectId } = require('mongodb'); await mdb.collection(name).deleteOne({ _id: new ObjectId(id) }); } catch(e) {}
}
async function saveToMongo(collection, data, id) {
  try {
    if (id) {
      await mdb.collection(collection).updateOne({ _id: id }, { $set: data }, { upsert: true });
    } else {
      const r = await mdb.collection(collection).insertOne({ ...data, createdAt: new Date() });
      return r.insertedId.toString();
    }
  } catch(e) { console.log('MongoDB save error:', e.message); }
}

let bookings = [], messages = [], users = [], catererUsers = [];
let notifications = [], notifIdCounter = 1;

function addNotification(type, text) {
  const n = { user: 'default', type, text, isRead: false, createdAt: new Date() };
  notifications.unshift(n);
  mdb.collection('notifications').insertOne(n).then(r => {
    if (r) n.id = r.insertedId.toString();
  }).catch(e => {});
}

setInterval(() => {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  bookings.forEach(b => {
    if (b.status === 'Partially Paid') {
      const eventDate = new Date(b.date + 'T00:00:00');
      const daysUntilEvent = Math.ceil((eventDate - now) / (1000 * 60 * 60 * 24));
      const dueDate = new Date(eventDate); dueDate.setDate(dueDate.getDate() - 7);
      const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
      if (daysUntilDue === 10) addNotification('reminder', '⏰ Reminder: Your remaining balance for your event on ' + b.date + ' is due in 10 days (' + dueDate.toLocaleDateString('en-PH', { month: 'long', day: 'numeric' }) + '). Please prepare your payment.');
      if (daysUntilDue <= 0 && daysUntilEvent >= 0) addNotification('reminder', '🚨 Urgent: Your remaining balance for your event on ' + b.date + ' is now due! Please complete your payment immediately.');
      if (daysUntilEvent === 3) addNotification('reminder', '⚠️ Final Reminder: Your event is in 3 days (' + b.date + '). Please settle your remaining balance as soon as possible.');
    }
  });
}, 24 * 60 * 60 * 1000);

let caterers = [], reviews = [], reviewIdCounter = 1;

const sharedCSS = `
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root { --orange: #E8450A; --orange-light: #fff0eb; --orange-mid: #ff6b35; --dark: #1A1A1A; --dark2: #2d2d2d; --white: #ffffff; --bg: #f8f8f8; --border: #e8e8e8; --muted: #888888; --text: #333333; }
    body { font-family: 'Poppins', sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; }
    .header { background: var(--dark); padding: 0 40px; height: 62px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 200; box-shadow: 0 2px 12px rgba(0,0,0,0.18); }
    .header-brand { font-size: 1.25rem; font-weight: 700; color: var(--white); letter-spacing: -0.01em; text-decoration: none; }
    .header-brand span { color: var(--orange); }
    .header-nav { display: flex; align-items: center; gap: 8px; }
    .header-nav a { color: #aaa; text-decoration: none; font-size: 0.82rem; font-weight: 500; padding: 6px 12px; border-radius: 6px; transition: color 0.2s, background 0.2s; }
    .header-nav a:hover { color: var(--white); background: rgba(255,255,255,0.08); }
    .notif-wrapper { position: relative; margin-left: 2px; }
    .notif-btn { background: rgba(255,255,255,0.08); border: none; cursor: pointer; font-size: 1rem; color: #ccc; display: flex; align-items: center; gap: 5px; padding: 7px 12px; border-radius: 8px; transition: background 0.2s, color 0.2s; font-family: 'Poppins', sans-serif; }
    .notif-btn:hover { background: rgba(255,255,255,0.14); color: var(--white); }
    .notif-badge { background: var(--orange); color: #fff; font-size: 0.62rem; font-weight: 700; border-radius: 999px; padding: 2px 6px; min-width: 18px; text-align: center; font-family: 'Poppins', sans-serif; }
    .notif-dropdown { display: none; position: absolute; right: 0; top: 46px; width: 310px; background: var(--white); border: 1px solid var(--border); border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.14); z-index: 999; overflow: hidden; }
    .notif-dropdown.open { display: block; }
    .notif-header-row { padding: 14px 16px 10px; border-bottom: 1px solid var(--border); background: var(--bg); }
    .notif-title { font-size: 0.88rem; font-weight: 600; color: var(--dark); }
    .notif-empty { padding: 24px 16px; font-size: 0.83rem; color: var(--muted); text-align: center; }
    .notif-item { padding: 12px 16px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.15s; text-decoration: none; display: block; }
    .notif-item:last-child { border-bottom: none; }
    .notif-item:hover { background: var(--bg); }
    .notif-item.unread { background: var(--orange-light); }
    .notif-text { font-size: 0.83rem; color: var(--text); line-height: 1.4; }
    .notif-item.unread .notif-text { font-weight: 600; color: var(--dark); }
    .notif-time { font-size: 0.7rem; color: var(--muted); margin-top: 3px; }
    .profile-wrapper { position: relative; margin-left: 2px; }
    .profile-btn { width: 36px; height: 36px; border-radius: 50%; background: var(--orange); border: 2px solid rgba(255,255,255,0.2); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.88rem; font-weight: 700; color: var(--white); font-family: 'Poppins', sans-serif; transition: border-color 0.2s, transform 0.15s; }
    .profile-btn:hover { border-color: var(--orange); transform: scale(1.05); }
    .profile-dropdown { display: none; position: absolute; right: 0; top: 46px; width: 220px; background: var(--white); border: 1px solid var(--border); border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.14); z-index: 999; overflow: hidden; }
    .profile-dropdown.open { display: block; }
    .profile-dropdown-header { padding: 14px 16px 12px; border-bottom: 1px solid var(--border); background: var(--bg); }
    .profile-dropdown-name { font-size: 0.88rem; font-weight: 700; color: var(--dark); }
    .profile-dropdown-email { font-size: 0.75rem; color: var(--muted); margin-top: 2px; }
    .profile-dropdown-item { display: flex; align-items: center; gap: 10px; padding: 11px 16px; font-size: 0.85rem; color: var(--text); text-decoration: none; transition: background 0.15s; font-family: 'Poppins', sans-serif; border: none; background: none; width: 100%; cursor: pointer; font-weight: 500; }
    .profile-dropdown-item:hover { background: var(--bg); }
    .profile-dropdown-item.logout { color: #e53e3e; border-top: 1px solid var(--border); }
    .profile-dropdown-item.logout:hover { background: #fff5f5; }
    label { display: block; font-size: 0.75rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
    input, select, textarea { width: 100%; padding: 11px 14px; border: 1.5px solid var(--border); border-radius: 8px; font-family: 'Poppins', sans-serif; font-size: 0.92rem; color: var(--dark); background: var(--white); outline: none; transition: border-color 0.2s, box-shadow 0.2s; }
    input:focus, select:focus, textarea:focus { border-color: var(--orange); box-shadow: 0 0 0 3px rgba(232,69,10,0.1); }
    select { cursor: pointer; -webkit-appearance: auto; appearance: auto; }
    input[type="file"] { padding: 9px; cursor: pointer; background: var(--bg); }
    .btn-primary { display: inline-flex; align-items: center; justify-content: center; padding: 12px 24px; background: var(--orange); color: var(--white); border: none; border-radius: 8px; font-family: 'Poppins', sans-serif; font-size: 0.88rem; font-weight: 600; cursor: pointer; text-decoration: none; transition: background 0.2s, transform 0.15s; }
    .btn-primary:hover { background: #c93a08; transform: translateY(-1px); }
    .btn-secondary { display: inline-flex; align-items: center; justify-content: center; padding: 12px 24px; background: transparent; color: var(--text); border: 1.5px solid var(--border); border-radius: 8px; font-family: 'Poppins', sans-serif; font-size: 0.88rem; font-weight: 500; cursor: pointer; text-decoration: none; transition: border-color 0.2s, color 0.2s, transform 0.15s; }
    .btn-secondary:hover { border-color: var(--orange); color: var(--orange); transform: translateY(-1px); }
    .card { background: var(--white); border: 1px solid var(--border); border-radius: 12px; padding: 28px; box-shadow: 0 2px 12px rgba(0,0,0,0.05); }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
    .fade1 { opacity: 0; animation: fadeUp 0.4s ease forwards; }
    .fade2 { opacity: 0; animation: fadeUp 0.4s ease 0.08s forwards; }
    .fade3 { opacity: 0; animation: fadeUp 0.4s ease 0.16s forwards; }
    .fade4 { opacity: 0; animation: fadeUp 0.4s ease 0.24s forwards; }
    @media (max-width: 600px) { .header { padding: 0 16px; } .header-nav a { display: none; } }
  </style>
`;

const notifJS = `
  <script>
    function formatNotifTime(ts) { const d = new Date(ts); return d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) + ' · ' + d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }); }
    function getNotifLink(n) { if (n.type === 'message') return '/message?caterer=' + encodeURIComponent(n.caterer || ''); return '/dashboard'; }
    async function loadNotifications() {
      try {
        const res = await fetch('/notifications'); const data = await res.json();
        const badge = document.getElementById('notifBadge'); const list = document.getElementById('notifList');
        if (!badge || !list) return;
        const unread = data.filter(n => !n.isRead).length;
        if (unread > 0) { badge.style.display = 'inline-block'; badge.textContent = unread; } else { badge.style.display = 'none'; }
        if (data.length === 0) { list.innerHTML = '<p class="notif-empty">No notifications yet.</p>'; return; }
        list.innerHTML = '';
        data.forEach(n => { const a = document.createElement('a'); a.className = 'notif-item' + (n.isRead ? '' : ' unread'); a.href = '#'; a.onclick = async (e) => { e.preventDefault(); await fetch('/read-notification', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({id: n.id}) }); const text = (n.text||'').toLowerCase(); if (n.type==='reminder'||text.includes('remaining balance')||text.includes('balance due')||text.includes('partially paid')||text.includes('due')) { window.location.href='/dashboard'; } else if (n.type==='message'||text.includes('message')||text.includes('chat')) { window.location.href='/chats'; } else { window.location.href='/events'; } }; a.innerHTML = '<div class="notif-text">' + n.text + '</div><div class="notif-time">' + formatNotifTime(n.createdAt) + '</div>'; list.appendChild(a); });
      } catch(e) {}
    }
    async function toggleNotifDropdown() { const dd = document.getElementById('notifDropdown'); const ad = document.getElementById('accountDropdown'); if (ad) ad.classList.remove('open'); const isOpen = dd.classList.contains('open'); dd.classList.toggle('open'); if (!isOpen) { await loadNotifications(); } }
    function toggleAccountDropdown() { const ad = document.getElementById('accountDropdown'); const nd = document.getElementById('notifDropdown'); if (nd) nd.classList.remove('open'); if (ad) ad.classList.toggle('open'); }
    document.addEventListener('click', function(e) { const nw = document.querySelector('.notif-wrapper'); if (nw && !nw.contains(e.target)) { const dd = document.getElementById('notifDropdown'); if (dd) dd.classList.remove('open'); } const aw = document.querySelector('.account-wrapper'); if (aw && !aw.contains(e.target)) { const ad = document.getElementById('accountDropdown'); if (ad) ad.classList.remove('open'); } });
    loadNotifications();
    setInterval(loadNotifications, 5000);
  <\/script>
`;

// ===== HEADER HTML =====
// FIXES: active nav = pill (no underline), no account-name span, yellow notif badge, crimson logout
function headerHTML(activeNav, user) {
  const fullUser = user ? (users.find(u => u.email === user.email) || user) : null;
  const initial = fullUser && fullUser.name ? fullUser.name.charAt(0).toUpperCase() : '?';
  const displayName = fullUser ? fullUser.name : 'Guest';
  const displayEmail = fullUser ? fullUser.email : '';
  const photoHTML = fullUser && fullUser.photo ? `<img src="${fullUser.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : initial;

  return `
  <style>
    .header { background: #1A1A1A; padding: 0 40px; height: 62px; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; position: sticky; top: 0; z-index: 200; box-shadow: 0 2px 12px rgba(0,0,0,0.18); }
    .header-brand { font-size: 1.2rem; font-weight: 700; color: #fff; text-decoration: none; justify-self: start; }
    .header-brand span { color: #E8450A; }
    .header-center { display: flex; align-items: center; gap: 2px; justify-content: center; }
    .h-nav-link { color: #aaa; text-decoration: none; font-size: 0.82rem; font-weight: 500; padding: 7px 14px; border-radius: 6px; transition: color 0.2s, background 0.2s; white-space: nowrap; }
    .h-nav-link:hover { color: #fff; background: rgba(255,255,255,0.18); }
    .h-nav-link.active { color: #fff; background: rgba(255,255,255,0.18); border-radius: 6px; }
    .header-right { display: flex; align-items: center; gap: 8px; justify-content: flex-end; }
    .notif-wrapper { position: relative; }
    .notif-btn { background: rgba(255,255,255,0.08); border: none; cursor: pointer; font-size: 1.1rem; color: #ccc; display: flex; align-items: center; padding: 7px 10px; border-radius: 8px; transition: background 0.2s; position: relative; }
    .notif-btn:hover { background: rgba(255,255,255,0.14); color: #fff; }
    .notif-badge { position: absolute; top: 4px; right: 4px; background: #F7B731; color: #1A1A1A; font-size: 0.55rem; font-weight: 700; border-radius: 999px; padding: 1px 5px; min-width: 16px; text-align: center; font-family: 'Poppins', sans-serif; }
    .notif-dropdown { display: none; position: absolute; right: 0; top: 46px; width: 310px; background: #fff; border: 1px solid #e8e8e8; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.13); z-index: 999; overflow: hidden; }
    .notif-dropdown.open { display: block; }
    .notif-header-row { padding: 13px 15px 9px; border-bottom: 1px solid #e8e8e8; background: #f8f8f8; }
    .notif-title { font-size: 0.86rem; font-weight: 600; color: #1A1A1A; }
    .notif-empty { padding: 22px 15px; font-size: 0.82rem; color: #888; text-align: center; }
    .notif-item { padding: 11px 15px; border-bottom: 1px solid #e8e8e8; text-decoration: none; display: block; transition: background 0.15s; }
    .notif-item:last-child { border-bottom: none; }
    .notif-item:hover { background: #f8f8f8; }
    .notif-item.unread { background: #fff0eb; }
    .notif-text { font-size: 0.82rem; color: #333; line-height: 1.4; }
    .notif-item.unread .notif-text { font-weight: 600; color: #1A1A1A; }
    .notif-time { font-size: 0.68rem; color: #888; margin-top: 2px; }
    .account-wrapper { position: relative; }
    .account-btn { display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.08); border: none; cursor: pointer; padding: 0 12px; height: 38px; border-radius: 8px; transition: background 0.2s; font-family: 'Poppins', sans-serif; }
    .account-btn:hover { background: rgba(255,255,255,0.14); }
    .account-avatar { width: 26px; height: 26px; border-radius: 50%; background: rgba(255,255,255,0.25); display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; color: #fff; flex-shrink: 0; border: 1.5px solid rgba(255,255,255,0.5); overflow: hidden; }
    .account-chevron { color: #aaa; font-size: 0.6rem; opacity: 0.6; }
    .account-dropdown { display: none; position: absolute; right: 0; top: 46px; width: 220px; background: #fff; border: 1px solid #e8e8e8; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.13); z-index: 999; overflow: hidden; }
    .account-dropdown.open { display: block; }
    .account-dropdown-header { padding: 14px 16px 12px; border-bottom: 1px solid #e8e8e8; background: #f8f8f8; }
    .account-dropdown-name { font-size: 0.88rem; font-weight: 700; color: #1A1A1A; }
    .account-dropdown-email { font-size: 0.73rem; color: #888; margin-top: 2px; }
    .account-dropdown-item { display: flex; align-items: center; gap: 9px; padding: 11px 16px; font-size: 0.84rem; color: #333; text-decoration: none; transition: background 0.15s; font-family: 'Poppins', sans-serif; font-weight: 500; }
    .account-dropdown-item:hover { background: #f8f8f8; }
    .account-dropdown-item.logout { color: #b01e2d; border-top: 1px solid #e8e8e8; }
    .account-dropdown-item.logout:hover { background: #fde8eb; }
    @media (max-width: 780px) { .header { padding: 0 16px; grid-template-columns: auto 1fr auto; } .h-nav-link { font-size: 0.75rem; padding: 6px 8px; } }
    @media (max-width: 480px) { .header-center { display: none; } }
  </style>
  <header class="header">
    <a href="/dashboard" class="header-brand">Bunyi<span>.</span></a>
    <nav class="header-center">
      <a href="/dashboard" class="h-nav-link ${activeNav==='dashboard'?'active':''}">Dashboard</a>
      <a href="/browse" class="h-nav-link ${activeNav==='browse'?'active':''}">Browse</a>
      <a href="/chats" class="h-nav-link ${activeNav==='chats'?'active':''}">Messages</a>
    </nav>
    <div class="header-right">
      <div class="notif-wrapper">
        <button class="notif-btn" onclick="toggleNotifDropdown()">🔔 <span class="notif-badge" id="notifBadge" style="display:none;">0</span></button>
        <div class="notif-dropdown" id="notifDropdown">
          <div class="notif-header-row"><span class="notif-title">Notifications</span></div>
          <div id="notifList"><p class="notif-empty">No notifications yet.</p></div>
        </div>
      </div>
      <div class="account-wrapper">
        <button class="account-btn" onclick="toggleAccountDropdown()">
          <div class="account-avatar" style="overflow:hidden;">${photoHTML}</div>
          <span class="account-chevron">▾</span>
        </button>
        <div class="account-dropdown" id="accountDropdown">
          <div class="account-dropdown-header">
            <div class="account-dropdown-name">${displayName}</div>
            <div class="account-dropdown-email">${displayEmail}</div>
          </div>
          <a href="/account" class="account-dropdown-item">👤 My Account</a>
          <a href="/logout" class="account-dropdown-item logout">🚪 Log Out</a>
        </div>
      </div>
    </div>
  </header>`;
}

function requireLogin(req, res, next) { if (!req.session.user) return res.redirect('/login'); next(); }
function requireCaterer(req, res, next) { if (!req.session.caterer) return res.redirect('/caterer-login'); next(); }

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/select-role', (req, res) => res.sendFile(path.join(__dirname, 'select-role.html')));
app.get('/customer-login', (req, res) => res.sendFile(path.join(__dirname, 'customer-login.html')));
app.get('/caterer-login', (req, res) => res.sendFile(path.join(__dirname, 'caterer-login.html')));
app.get('/caterer-dashboard', (req, res) => res.sendFile(path.join(__dirname, 'caterer-dashboard.html')));
app.get('/caterer-bookings', requireCaterer, (req, res) => res.sendFile(path.join(__dirname, 'caterer-bookings.html')));
app.get('/caterer-products', requireCaterer, (req, res) => res.sendFile(path.join(__dirname, 'caterer-products.html')));
app.get('/caterer-messages', requireCaterer, (req, res) => res.sendFile(path.join(__dirname, 'caterer-messages.html')));

app.get('/caterer-session', (req, res) => { if (!req.session.caterer) return res.json({ loggedIn: false }); const cu = catererUsers.find(u => u.email === req.session.caterer.email); res.json({ loggedIn: true, businessName: req.session.caterer.businessName, email: req.session.caterer.email, photo: cu ? cu.photo : null }); });

// ===== CATERER REGISTER — handled client-side via Firebase SDK =====
app.post('/caterer-register', (req, res) => {
  return res.redirect('/caterer-login?verify=1');
});

app.post('/caterer-register-profile', async (req, res) => {
  const { email, password, businessName, businessAddress, contactNumber, description } = req.body;
  if (catererUsers.find(u => u.email === email)) return res.json({ ok: true });
  const newCaterer = { email, password, businessName, businessAddress, contactNumber, createdAt: new Date() };
  catererUsers.push(newCaterer);
  await mdb.collection('catererUsers').insertOne(newCaterer);
  if (!caterers.find(c => c.name === businessName)) {
    const newCatererEntry = { id: caterers.length + 1, name: businessName, description: description || 'Professional catering service.', location: businessAddress || '', image: '/placeholder.jpg', packages: [], qrCodes: [] };
    caterers.push(newCatererEntry);
    await mdb.collection('caterers').insertOne(newCatererEntry);
  }
  res.json({ ok: true });
});

app.post('/caterer-login', async (req, res) => {
  const { email, password } = req.body;
  const user = catererUsers.find(u => u.email === email && u.password === password);
  if (!user) return res.redirect('/caterer-login?loginerror=1');
  try {
    const firebaseUser = await admin.auth().getUserByEmail(email);
    if (!firebaseUser.emailVerified) {
      return res.redirect('/caterer-login?notverified=1');
    }
  } catch(e) {
    console.log('Firebase caterer check error:', e.message);
    // Allow login if Firebase check fails (older accounts)
  }
  req.session.caterer = { businessName: user.businessName, email: user.email };
  res.redirect('/caterer-dashboard');
});

let catererNotifications = {};

function addCatererNotification(businessName, type, text) {
  if (!catererNotifications[businessName]) catererNotifications[businessName] = [];
  const n = { type, text, isRead: false, createdAt: new Date() };
  catererNotifications[businessName].unshift(n);
  mdb.collection('catererNotifications').updateOne(
    { businessName },
    { $set: { items: catererNotifications[businessName] } },
    { upsert: true }
  ).catch(e => {});
}

app.get('/caterer-notifications', (req, res) => { if (!req.session.caterer) return res.json([]); const notes = catererNotifications[req.session.caterer.businessName] || []; res.json([...notes].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))); });
app.post('/caterer-read-notifications', async (req, res) => {
  if (!req.session.caterer) return res.json({ ok: true });
  const notes = catererNotifications[req.session.caterer.businessName] || [];
  notes.forEach(n => n.isRead = true);
  try {
    await mdb.collection('catererNotifications').updateOne(
      { businessName: req.session.caterer.businessName },
      { $set: { items: notes } },
      { upsert: true }
    );
  } catch(e) {}
  res.json({ ok: true });
});

app.get('/caterer-logout', (req, res) => { req.session.caterer = null; res.redirect('/caterer-login'); });
app.get('/login', (req, res) => res.redirect('/customer-login'));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'customer-login.html')));
app.get('/browse', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'customer-browse.html')));
app.get('/book', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'customer-book-payment.html')));
app.get('/dashboard', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'customer-dashboard.html')));

// ===== CUSTOMER REGISTER — handled client-side via Firebase SDK =====
app.post('/register', (req, res) => {
  return res.redirect('/customer-login?verify=1');
});

app.post('/register-profile', async (req, res) => {
  const { name, email, gender, password } = req.body;
  if (users.find(u => u.email === email)) return res.json({ ok: true });
  const newUser = { name, email, password, gender, phone: '', isVerified: false, createdAt: new Date() };
  users.push(newUser);
  await mdb.collection('users').insertOne(newUser);
  res.json({ ok: true });
});

// ===== CUSTOMER LOGIN — checks Firebase Auth email verification =====
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email && u.password === password);
  if (!user) return res.redirect('/login?error=1');
  // Check if email is verified via Firebase Auth
  try {
    const firebaseUser = await admin.auth().getUserByEmail(email);
    if (!firebaseUser.emailVerified) {
      return res.redirect('/customer-login?notverified=1');
    }
    user.isVerified = true;
  } catch(e) {
    console.log('Firebase Auth check error:', e.message);
    // If Firebase Auth check fails (e.g. user registered before Auth was added), allow login
  }
  req.session.user = { name: user.name, email: user.email };
  res.redirect('/dashboard');
});

// ===== RESEND VERIFICATION EMAIL =====
app.post('/resend-verification', async (req, res) => {
  const { email } = req.body;
  try {
    await admin.auth().generateEmailVerificationLink(email);
    res.json({ success: true });
  } catch(e) {
    res.json({ success: false, error: e.message });
  }
});
app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });

// ===== MY ACCOUNT PAGE =====
// FIXES: color-strip added, no account-name span, crimson dot, yellow notif badge
app.get('/account', requireLogin, (req, res) => {
  const user = users.find(u => u.email === req.session.user.email);
  if (!user) return res.redirect('/customer-login');
  const saved = req.query.saved || '';
  const tab = req.query.tab || 'info';

  res.send(`
    <!DOCTYPE html><html lang="en"><head>
      <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>My Account – Bunyi</title>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
      <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root { --orange: #E8450A; --orange-light: #fff0eb; --dark: #1A1A1A; --white: #fff; --bg: #f8f8f8; --border: #e8e8e8; --muted: #888; --text: #333; }
        body { font-family: 'Poppins', sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; }
        .color-strip { height: 4px; background: linear-gradient(90deg, #D72638, #F26419, #F7B731); }
        .header { background: var(--dark); padding: 0 40px; height: 62px; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; position: sticky; top: 0; z-index: 200; box-shadow: 0 2px 12px rgba(0,0,0,0.18); }
        .header-brand { font-size: 1.25rem; font-weight: 700; color: var(--white); letter-spacing: -0.01em; text-decoration: none; justify-self: start; }
        .header-brand span { color: #D72638; }
        .header-center { display: flex; align-items: center; gap: 2px; justify-content: center; }
        .nav-link { color: #aaa; text-decoration: none; font-size: 0.82rem; font-weight: 500; padding: 7px 14px; border-radius: 6px; transition: color 0.2s, background 0.2s; white-space: nowrap; }
        .nav-link:hover { color: var(--white); background: rgba(255,255,255,0.18); }
        .header-right { display: flex; align-items: center; gap: 8px; justify-content: flex-end; }
        .notif-wrapper { position: relative; }
        .notif-btn { background: rgba(255,255,255,0.08); border: none; cursor: pointer; font-size: 1.1rem; color: #ccc; display: flex; align-items: center; padding: 7px 10px; border-radius: 8px; transition: background 0.2s; position: relative; }
        .notif-btn:hover { background: rgba(255,255,255,0.14); color: #fff; }
        .notif-badge { position: absolute; top: 4px; right: 4px; background: #F7B731; color: #1A1A1A; font-size: 0.55rem; font-weight: 700; border-radius: 999px; padding: 1px 5px; min-width: 16px; text-align: center; }
        .notif-dropdown { display: none; position: absolute; right: 0; top: 46px; width: 310px; background: #fff; border: 1px solid #e8e8e8; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.13); z-index: 999; overflow: hidden; }
        .notif-dropdown.open { display: block; }
        .notif-header-row { padding: 13px 15px 9px; border-bottom: 1px solid #e8e8e8; background: #f8f8f8; }
        .notif-title { font-size: 0.86rem; font-weight: 600; color: #1A1A1A; }
        .notif-empty { padding: 22px 15px; font-size: 0.82rem; color: #888; text-align: center; }
        .notif-scroll { max-height: 280px; overflow-y: auto; }
        .notif-item { padding: 11px 15px; border-bottom: 1px solid #e8e8e8; text-decoration: none; display: block; transition: background 0.15s; }
        .notif-item:last-child { border-bottom: none; }
        .notif-item:hover { background: #f8f8f8; }
        .notif-item.unread { background: #fff0eb; }
        .notif-text { font-size: 0.82rem; color: #333; line-height: 1.4; }
        .notif-item.unread .notif-text { font-weight: 600; color: #1A1A1A; }
        .notif-time { font-size: 0.68rem; color: #888; margin-top: 2px; }
        .account-wrapper { position: relative; }
        .account-btn { display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.08); border: none; cursor: pointer; padding: 0 12px; height: 38px; border-radius: 8px; transition: background 0.2s; font-family: 'Poppins', sans-serif; }
        .account-btn:hover { background: rgba(255,255,255,0.14); }
        .account-avatar { width: 26px; height: 26px; border-radius: 50%; background: rgba(255,255,255,0.25); display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; color: #fff; flex-shrink: 0; border: 1.5px solid rgba(255,255,255,0.5); overflow: hidden; }
        .account-chevron { color: #aaa; font-size: 0.6rem; opacity: 0.6; }
        .account-dropdown { display: none; position: absolute; right: 0; top: 46px; width: 220px; background: var(--white); border: 1px solid var(--border); border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.13); z-index: 999; overflow: hidden; }
        .account-dropdown.open { display: block; }
        .account-dropdown-header { padding: 14px 16px 12px; border-bottom: 1px solid var(--border); background: var(--bg); }
        .account-dropdown-name { font-size: 0.88rem; font-weight: 700; color: var(--dark); }
        .account-dropdown-email { font-size: 0.73rem; color: var(--muted); margin-top: 2px; }
        .account-dropdown-item { display: flex; align-items: center; gap: 9px; padding: 11px 16px; font-size: 0.84rem; color: var(--text); text-decoration: none; transition: background 0.15s; font-family: 'Poppins', sans-serif; font-weight: 500; }
        .account-dropdown-item:hover { background: var(--bg); }
        .account-dropdown-item.logout { color: #b01e2d; border-top: 1px solid var(--border); }
        .account-dropdown-item.logout:hover { background: #fde8eb; }
        .hamburger-btn { display: none !important; background: rgba(255,255,255,0.08); border: none; cursor: pointer; width: 38px; height: 38px; border-radius: 8px; flex-direction: column; align-items: center; justify-content: center; gap: 5px; transition: background 0.2s; }
        .hamburger-btn:hover { background: rgba(255,255,255,0.14); }
        .hamburger-btn span { display: block; width: 18px; height: 2px; background: #ccc; border-radius: 2px; }
        .mobile-nav { display: none; position: fixed; top: 66px; left: 0; right: 0; background: #1A1A1A; z-index: 199; padding: 8px 16px 12px; border-bottom: 1px solid rgba(255,255,255,0.1); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
        .mobile-nav.open { display: block; }
        .mobile-nav a { display: block; color: #aaa; text-decoration: none; font-size: 0.9rem; font-weight: 500; padding: 12px 14px; border-radius: 8px; transition: color 0.2s, background 0.2s; }
        .mobile-nav a:hover, .mobile-nav a.active { color: #fff; background: rgba(255,255,255,0.18); }
        @media (max-width: 780px) { .header { padding: 0 16px; grid-template-columns: auto 1fr auto; } .header-center { gap: 0; display: none !important; } .nav-link { font-size: 0.75rem; padding: 6px 8px; } .hamburger-btn { display: flex !important; } }
        .main { max-width: 680px; margin: 0 auto; padding: 44px 24px 80px; }
        .back-link { display: inline-flex; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--muted); text-decoration: none; margin-bottom: 20px; transition: color 0.2s; }
        .back-link:hover { color: var(--orange); }
        .page-eyebrow { font-size: 0.7rem; font-weight: 600; color: var(--orange); text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 6px; }
        .page-title { font-size: 1.4rem; font-weight: 700; color: var(--dark); margin-bottom: 24px; }
        .profile-row { display: flex; align-items: center; gap: 16px; margin-bottom: 28px; }
        .big-avatar { width: 64px; height: 64px; border-radius: 50%; background: var(--orange); display: flex; align-items: center; justify-content: center; font-size: 1.6rem; font-weight: 700; color: var(--white); flex-shrink: 0; }
        .profile-info-name { font-size: 1.1rem; font-weight: 700; color: var(--dark); }
        .profile-info-email { font-size: 0.82rem; color: var(--muted); margin-top: 2px; }
        .tab-bar { display: flex; gap: 4px; background: var(--white); border: 1px solid var(--border); border-radius: 10px; padding: 4px; margin-bottom: 24px; }
        .tab-btn { flex: 1; padding: 9px 12px; border: none; border-radius: 7px; font-family: 'Poppins', sans-serif; font-size: 0.82rem; font-weight: 600; cursor: pointer; background: transparent; color: var(--muted); transition: background 0.2s, color 0.2s; text-decoration: none; text-align: center; }
        .tab-btn.active { background: var(--orange); color: var(--white); }
        .card { background: var(--white); border: 1px solid var(--border); border-radius: 12px; padding: 28px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
        .section-label { font-size: 0.7rem; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid var(--border); }
        .form-group { margin-bottom: 16px; }
        label { display: block; font-size: 0.72rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 5px; }
        input, select { width: 100%; padding: 11px 14px; border: 1.5px solid var(--border); border-radius: 8px; font-family: 'Poppins', sans-serif; font-size: 0.92rem; color: var(--dark); background: var(--white); outline: none; transition: border-color 0.2s, box-shadow 0.2s; }
        input:focus, select:focus { border-color: var(--orange); box-shadow: 0 0 0 3px rgba(232,69,10,0.1); }
        .read-field { padding: 11px 14px; background: var(--bg); border: 1.5px solid var(--border); border-radius: 8px; font-size: 0.92rem; color: var(--muted); font-family: 'Poppins', sans-serif; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .save-btn { width: 100%; padding: 13px; background: var(--orange); color: var(--white); border: none; border-radius: 8px; font-family: 'Poppins', sans-serif; font-size: 0.92rem; font-weight: 700; cursor: pointer; transition: background 0.2s; margin-top: 8px; }
        .save-btn:hover { background: #c93a08; }
        .divider { height: 1px; background: var(--border); margin: 22px 0; }
        .logout-btn { width: 100%; padding: 12px; background: transparent; color: #e53e3e; border: 1.5px solid #fed7d7; border-radius: 8px; font-family: 'Poppins', sans-serif; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: background 0.2s; text-align: center; text-decoration: none; display: block; }
        .logout-btn:hover { background: #fff5f5; }
        .success-msg { background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 10px 14px; font-size: 0.84rem; color: #16a34a; margin-bottom: 18px; font-weight: 500; }
        .setting-row { display: flex; align-items: center; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid var(--border); }
        .setting-row:last-child { border-bottom: none; }
        .setting-label { font-size: 0.88rem; font-weight: 600; color: var(--dark); }
        .setting-sub { font-size: 0.76rem; color: var(--muted); margin-top: 2px; }
        .toggle { width: 42px; height: 24px; border-radius: 999px; background: var(--border); border: none; cursor: pointer; position: relative; transition: background 0.2s; flex-shrink: 0; }
        .toggle.on { background: var(--orange); }
        .toggle::after { content: ''; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: var(--white); transition: left 0.2s; box-shadow: 0 1px 4px rgba(0,0,0,0.2); }
        .toggle.on::after { left: 21px; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { opacity: 0; animation: fadeUp 0.4s ease forwards; }
        @media (max-width: 600px) { .header { padding: 0 16px; } .form-row { grid-template-columns: 1fr; } .main { padding: 28px 16px 60px; } }
      </style>
    </head>
    <body>
      <div class="color-strip"></div>
      <div class="mobile-nav" id="mobileNav">
        <a href="/dashboard">Dashboard</a>
        <a href="/browse">Browse</a>
        <a href="/chats">Messages</a>
      </div>
      <header class="header">
        <a href="/dashboard" class="header-brand">Bunyi<span>.</span></a>
        <nav class="header-center">
          <a href="/dashboard" class="nav-link">Dashboard</a>
          <a href="/browse" class="nav-link">Browse</a>
          <a href="/chats" class="nav-link">Messages</a>
        </nav>
        <div class="header-right">
<button class="hamburger-btn" onclick="toggleMobileNav()" id="hamburgerBtn">
            <span></span><span></span><span></span>
          </button>
          <a href="/cart" style="background:rgba(255,255,255,0.08);border:none;cursor:pointer;font-size:1.1rem;color:#ccc;display:flex;align-items:center;padding:7px 10px;border-radius:8px;transition:background 0.2s;position:relative;text-decoration:none;" id="cartBtnAcct" title="My Cart">🛒 <span id="cartBadgeAcct" style="position:absolute;top:4px;right:4px;background:#16a34a;color:#fff;font-size:0.55rem;font-weight:700;border-radius:999px;padding:1px 5px;min-width:16px;text-align:center;display:none;">0</span></a>          <div class="notif-wrapper">
            <button class="notif-btn" onclick="toggleNotifDropdown()">🔔 <span class="notif-badge" id="notifBadge" style="display:none;">0</span></button>
            <div class="notif-dropdown" id="notifDropdown">
              <div class="notif-header-row"><span class="notif-title">Notifications</span></div>
              <div class="notif-scroll" id="notifList"><p class="notif-empty">No notifications yet.</p></div>
            </div>
          </div>
          <div class="account-wrapper">
            <button class="account-btn" onclick="toggleAccountDropdown()">
              <div class="account-avatar" style="${user.photo ? 'background:none;padding:0;overflow:hidden;' : ''}">${user.photo ? `<img src="${user.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : user.name.charAt(0).toUpperCase()}</div>
              <span class="account-chevron">▾</span>
            </button>
            <div class="account-dropdown" id="accountDropdown">
              <div class="account-dropdown-header">
                <div class="account-dropdown-name">${user.name}</div>
                <div class="account-dropdown-email">${user.email}</div>
              </div>
              <a href="/account" class="account-dropdown-item">👤 My Account</a>
              <a href="/logout" class="account-dropdown-item logout">🚪 Log Out</a>
            </div>
          </div>
        </div>
      </header>
      <main class="main">
        <a href="/dashboard" class="back-link">← Back to Dashboard</a>
        <p class="page-eyebrow">Profile</p>
        <h1 class="page-title">My Account</h1>
        ${saved === '1' ? '<div class="success-msg fade-in">✅ Changes saved successfully.</div>' : ''}
        <div class="profile-row fade-in">
          <div class="big-avatar" id="bigAvatar" style="${user.photo ? 'background:none;padding:0;overflow:hidden;' : ''}">
            ${user.photo ? `<img src="${user.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div class="profile-info-name">${user.name}</div>
            <div class="profile-info-email">${user.email}</div>
            <label for="photoUpload" style="display:inline-block;margin-top:8px;padding:6px 14px;background:#fff0eb;color:#E8450A;border-radius:8px;font-size:0.76rem;font-weight:600;cursor:pointer;border:1.5px solid rgba(232,69,10,0.2);text-transform:none;letter-spacing:0;">📷 Change Photo</label>
            <input type="file" id="photoUpload" accept="image/*" style="display:none;" onchange="uploadPhoto(this)">
            <div id="photoMsg" style="font-size:0.74rem;margin-top:4px;color:#16a34a;"></div>
          </div>
        </div>
        <div class="tab-bar fade-in">
          <a href="/account?tab=info" class="tab-btn ${tab === 'info' ? 'active' : ''}">Account Information</a>
          <a href="/account?tab=settings" class="tab-btn ${tab === 'settings' ? 'active' : ''}">Settings & Privacy</a>
        </div>
        ${tab === 'info' ? `
        <div class="card fade-in">
          <p class="section-label">Personal Information</p>
          <div class="form-row">
            <div class="form-group"><label>Full Name</label><div class="read-field">${user.name}</div></div>
            <div class="form-group"><label>Gender</label><div class="read-field">${user.gender || 'Not specified'}</div></div>
          </div>
          <div class="divider"></div>
          <p class="section-label">Contact Information</p>
          <form action="/account/update" method="POST">
          <div class="form-row">
            <div class="form-group"><label>Full Name</label><input type="text" name="name" value="${user.name || ''}" required></div>
            <div class="form-group"><label>Gender</label>
              <select name="gender">
                <option value="" ${!user.gender ? 'selected' : ''}>Not specified</option>
                <option value="Male" ${user.gender === 'Male' ? 'selected' : ''}>Male</option>
                <option value="Female" ${user.gender === 'Female' ? 'selected' : ''}>Female</option>
                <option value="Others" ${user.gender === 'Others' ? 'selected' : ''}>Others</option>
              </select>
            </div>
          </div>
          <div class="form-group"><label>Email Address</label><input type="email" name="email" value="${user.email}" required></div>
          <div class="form-group"><label>Address</label><input type="text" name="address" value="${user.address || ''}" placeholder="Street, City, Province"></div>
          <div class="form-group"><label>Contact Number</label><input type="tel" name="phone" value="${user.phone || ''}" placeholder="e.g. 09xxxxxxxxx"></div>
          <button type="submit" class="save-btn">Save Changes</button>
        </form>
          <div class="divider"></div>
          <a href="/logout" class="logout-btn">🚪 Log Out</a>
        </div>
        ` : `
        <div class="card fade-in">
          ${req.query.pwsaved === '1' ? '<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:10px 14px;font-size:0.84rem;color:#16a34a;margin-bottom:18px;font-weight:500;">✅ Password updated successfully.</div>' : ''}
          ${req.query.pwerror === 'wrong' ? '<div style="background:#fff0eb;border:1px solid #ffd0bc;border-radius:8px;padding:10px 14px;font-size:0.84rem;color:#c93a08;margin-bottom:18px;font-weight:500;">❌ Current password is incorrect.</div>' : ''}
          ${req.query.pwerror === 'short' ? '<div style="background:#fff0eb;border:1px solid #ffd0bc;border-radius:8px;padding:10px 14px;font-size:0.84rem;color:#c93a08;margin-bottom:18px;font-weight:500;">❌ New password must be at least 6 characters.</div>' : ''}
          ${req.query.pwerror === 'mismatch' ? '<div style="background:#fff0eb;border:1px solid #ffd0bc;border-radius:8px;padding:10px 14px;font-size:0.84rem;color:#c93a08;margin-bottom:18px;font-weight:500;">❌ Passwords do not match.</div>' : ''}
          ${req.query.delerror === 'wrong' ? '<div style="background:#fff0eb;border:1px solid #ffd0bc;border-radius:8px;padding:10px 14px;font-size:0.84rem;color:#c93a08;margin-bottom:18px;font-weight:500;">❌ Incorrect password. Account not deleted.</div>' : ''}
          <p class="section-label">Notifications</p>
          <div class="setting-row"><div><div class="setting-label">Payment Reminders</div><div class="setting-sub">Get notified about upcoming balance due dates</div></div><button class="toggle on" onclick="this.classList.toggle('on')"></button></div>
          <div class="setting-row"><div><div class="setting-label">Booking Updates</div><div class="setting-sub">Receive updates when your booking status changes</div></div><button class="toggle on" onclick="this.classList.toggle('on')"></button></div>
          <div class="setting-row"><div><div class="setting-label">New Messages</div><div class="setting-sub">Get notified when caterers send you messages</div></div><button class="toggle on" onclick="this.classList.toggle('on')"></button></div>
          <div class="divider"></div>
          <p class="section-label">Privacy</p>
          <div class="setting-row"><div><div class="setting-label">Profile Visibility</div><div class="setting-sub">Allow caterers to see your profile information</div></div><button class="toggle on" onclick="this.classList.toggle('on')"></button></div>
          <div class="setting-row"><div><div class="setting-label">Activity Status</div><div class="setting-sub">Show when you were last active</div></div><button class="toggle" onclick="this.classList.toggle('on')"></button></div>
          <div class="divider"></div>
          <p class="section-label">Account</p>
          <div class="setting-row"><div><div class="setting-label">Change Password</div><div class="setting-sub">Update your account password</div></div><button onclick="document.getElementById('changePwModal').style.display='flex'" style="font-size:0.82rem;font-weight:600;color:var(--orange);background:none;border:none;cursor:pointer;font-family:'Poppins',sans-serif;">Change →</button></div>
          <div class="setting-row"><div><div class="setting-label" style="color:#e53e3e;">Delete Account</div><div class="setting-sub">Permanently remove your account and data</div></div><button onclick="document.getElementById('deleteAcctModal').style.display='flex'" style="font-size:0.82rem;font-weight:600;color:#e53e3e;background:none;border:none;cursor:pointer;font-family:'Poppins',sans-serif;">Delete →</button></div>
        </div>
        `}
        <div id="changePwModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);z-index:9999;align-items:center;justify-content:center;padding:20px;">
          <div style="background:#fff;border-radius:14px;width:100%;max-width:440px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.25);">
            <div style="background:#1A1A1A;padding:20px 24px;display:flex;align-items:center;justify-content:space-between;"><div><div style="font-size:0.68rem;font-weight:600;color:#E8450A;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:3px;">Security</div><div style="font-size:1.1rem;font-weight:700;color:#fff;">Change Password</div></div><button onclick="document.getElementById('changePwModal').style.display='none'" style="background:rgba(255,255,255,0.1);border:none;color:#fff;font-size:1.1rem;width:32px;height:32px;border-radius:50%;cursor:pointer;line-height:1;">x</button></div>
            <form action="/account/change-password" method="POST" style="padding:24px;">
              <div style="margin-bottom:14px;"><label style="display:block;font-size:0.7rem;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:5px;font-family:'Poppins',sans-serif;">Current Password</label><input type="password" name="currentPassword" required placeholder="Enter current password" style="width:100%;padding:11px 14px;border:1.5px solid #e8e8e8;border-radius:8px;font-family:'Poppins',sans-serif;font-size:0.9rem;outline:none;" onfocus="this.style.borderColor='#E8450A'" onblur="this.style.borderColor='#e8e8e8'"></div>
              <div style="margin-bottom:14px;"><label style="display:block;font-size:0.7rem;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:5px;font-family:'Poppins',sans-serif;">New Password</label><input type="password" name="newPassword" required placeholder="Minimum 6 characters" style="width:100%;padding:11px 14px;border:1.5px solid #e8e8e8;border-radius:8px;font-family:'Poppins',sans-serif;font-size:0.9rem;outline:none;" onfocus="this.style.borderColor='#E8450A'" onblur="this.style.borderColor='#e8e8e8'"></div>
              <div style="margin-bottom:22px;"><label style="display:block;font-size:0.7rem;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:5px;font-family:'Poppins',sans-serif;">Confirm New Password</label><input type="password" name="confirmPassword" required placeholder="Repeat new password" style="width:100%;padding:11px 14px;border:1.5px solid #e8e8e8;border-radius:8px;font-family:'Poppins',sans-serif;font-size:0.9rem;outline:none;" onfocus="this.style.borderColor='#E8450A'" onblur="this.style.borderColor='#e8e8e8'"></div>
              <div style="display:flex;gap:10px;"><button type="button" onclick="document.getElementById('changePwModal').style.display='none'" style="flex:1;padding:11px;background:transparent;color:#888;border:1.5px solid #e8e8e8;border-radius:8px;font-family:'Poppins',sans-serif;font-size:0.88rem;cursor:pointer;">Cancel</button><button type="submit" style="flex:2;padding:11px;background:#E8450A;color:#fff;border:none;border-radius:8px;font-family:'Poppins',sans-serif;font-size:0.88rem;font-weight:700;cursor:pointer;">Update Password</button></div>
            </form>
          </div>
        </div>
        <div id="deleteAcctModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);z-index:9999;align-items:center;justify-content:center;padding:20px;">
          <div style="background:#fff;border-radius:14px;width:100%;max-width:440px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.25);">
            <div style="background:#1A1A1A;padding:20px 24px;display:flex;align-items:center;justify-content:space-between;"><div><div style="font-size:0.68rem;font-weight:600;color:#e53e3e;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:3px;">Danger Zone</div><div style="font-size:1.1rem;font-weight:700;color:#fff;">Delete Account</div></div><button onclick="document.getElementById('deleteAcctModal').style.display='none'" style="background:rgba(255,255,255,0.1);border:none;color:#fff;font-size:1.1rem;width:32px;height:32px;border-radius:50%;cursor:pointer;line-height:1;">x</button></div>
            <div style="padding:24px;"><p style="font-size:0.88rem;color:#555;line-height:1.6;margin-bottom:20px;font-family:'Poppins',sans-serif;">This will <strong>permanently delete</strong> your account and all your data. This action <strong>cannot be undone</strong>.</p>
              <form action="/account/delete" method="POST"><div style="margin-bottom:20px;"><label style="display:block;font-size:0.7rem;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:5px;font-family:'Poppins',sans-serif;">Enter your password to confirm</label><input type="password" name="password" required placeholder="Your password" style="width:100%;padding:11px 14px;border:1.5px solid #e8e8e8;border-radius:8px;font-family:'Poppins',sans-serif;font-size:0.9rem;outline:none;" onfocus="this.style.borderColor='#e53e3e'" onblur="this.style.borderColor='#e8e8e8'"></div><div style="display:flex;gap:10px;"><button type="button" onclick="document.getElementById('deleteAcctModal').style.display='none'" style="flex:1;padding:11px;background:transparent;color:#888;border:1.5px solid #e8e8e8;border-radius:8px;font-family:'Poppins',sans-serif;font-size:0.88rem;cursor:pointer;">Cancel</button><button type="submit" style="flex:2;padding:11px;background:#e53e3e;color:#fff;border:none;border-radius:8px;font-family:'Poppins',sans-serif;font-size:0.88rem;font-weight:700;cursor:pointer;">Yes, Delete My Account</button></div></form>
            </div>
          </div>
        </div>
      </main>
      <script>
        function toggleAccountDropdown() { const ad = document.getElementById('accountDropdown'); const nd = document.getElementById('notifDropdown'); if (nd) nd.classList.remove('open'); ad.classList.toggle('open'); }
        async function toggleNotifDropdown() { const dd = document.getElementById('notifDropdown'); const ad = document.getElementById('accountDropdown'); if (ad) ad.classList.remove('open'); dd.classList.toggle('open'); if (dd.classList.contains('open')) { await loadNotifications(); } }
        async function loadNotifications() {
          try {
            const res = await fetch('/notifications'); const data = await res.json();
            const badge = document.getElementById('notifBadge'); const list = document.getElementById('notifList');
            const unread = data.filter(n => !n.isRead).length;
            if (unread > 0) { badge.style.display = 'inline-block'; badge.textContent = unread; } else { badge.style.display = 'none'; }
            if (data.length === 0) { list.innerHTML = '<p class="notif-empty">No notifications yet.</p>'; return; }
            list.innerHTML = '';
            data.slice().reverse().forEach (n => {
            const a = document.createElement('a'); a.className = 'notif-item' + (n.isRead ? '' : ' unread'); a.href = '#'; a.onclick = async (e) => { e.preventDefault(); await fetch('/read-notification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: n.id }) }); loadNotifications(); }; a.innerHTML = '<div class="notif-text">' + n.text + '</div><div class="notif-time">' + new Date(n.createdAt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) + ' · ' + new Date(n.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) + '</div>'; list.appendChild(a); });
          } catch(e) {}
        }
        function loadCartBadge() { try { const cart = JSON.parse(sessionStorage.getItem('bunyi_cart') || '[]'); const total = cart.reduce((s, i) => s + (i.qty || 1), 0); const badge = document.getElementById('cartBadgeAcct'); if (badge) { badge.textContent = total; badge.style.display = total > 0 ? 'inline-block' : 'none'; } } catch(e) {} }
        document.addEventListener('click', function(e) { const nw = document.querySelector('.notif-wrapper'); if (nw && !nw.contains(e.target)) { const dd = document.getElementById('notifDropdown'); if (dd) dd.classList.remove('open'); } const aw = document.querySelector('.account-wrapper'); if (aw && !aw.contains(e.target)) { const ad = document.getElementById('accountDropdown'); if (ad) ad.classList.remove('open'); } const nav = document.getElementById('mobileNav'); const btn = document.getElementById('hamburgerBtn'); if (nav && btn && !nav.contains(e.target) && !btn.contains(e.target)) nav.classList.remove('open'); });
        function toggleMobileNav() { document.getElementById('mobileNav').classList.toggle('open'); }
        loadNotifications(); loadCartBadge(); setInterval(loadNotifications, 5000);
        async function uploadPhoto(input) { if (!input.files[0]) return; const formData = new FormData(); formData.append('photo', input.files[0]); try { const res = await fetch('/upload-profile-photo', { method: 'POST', body: formData }); const data = await res.json(); if (data.success) { document.getElementById('photoMsg').textContent = '✅ Photo updated!'; const big = document.getElementById('bigAvatar'); big.style.background = 'none'; big.style.padding = '0'; big.style.overflow = 'hidden'; big.innerHTML = '<img src="' + data.photo + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">'; } } catch(e) { document.getElementById('photoMsg').textContent = '❌ Upload failed.'; } }
      </script>
      <script src='https://cdn.jotfor.ms/agent/embedjs/019e466996117451b02c25c833a184e8bfc4/embed.js'></script>
    </body></html>
  `);
});

app.post('/account/change-password', requireLogin, async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const user = users.find(u => u.email === req.session.user.email);
  if (!user) return res.redirect('/customer-login');
  if (user.password !== currentPassword) return res.redirect('/account?tab=settings&pwerror=wrong');
  if (newPassword.length < 6) return res.redirect('/account?tab=settings&pwerror=short');
  if (newPassword !== confirmPassword) return res.redirect('/account?tab=settings&pwerror=mismatch');
  user.password = newPassword;
  try {
    await mdb.collection('users').updateOne({ email: user.email }, { $set: { password: newPassword } });
  } catch(e) { console.error('Change password failed:', e.message); }
  res.redirect('/account?tab=settings&pwsaved=1');
});

app.post('/account/delete', requireLogin, (req, res) => { const { password } = req.body; const userIndex = users.findIndex(u => u.email === req.session.user.email); if (userIndex === -1) return res.redirect('/customer-login'); if (users[userIndex].password !== password) return res.redirect('/account?tab=settings&delerror=wrong'); users.splice(userIndex, 1); req.session.destroy(); res.redirect('/?deleted=1'); });

// ===== UPLOAD PROFILE PHOTO — Cloudinary =====
app.post('/upload-profile-photo', requireLogin, upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const user = users.find(u => u.email === req.session.user.email);
  if (!user) return res.status(404).json({ error: 'User not found' });
  try {
    const photoUrl = await uploadToCloudinary(req.file.buffer, req.file.mimetype, 'bunyi/profiles');
    user.photo = photoUrl; req.session.user.photo = photoUrl; req.session.save();
    await mdb.collection('users').updateOne({ email: user.email }, { $set: { photo: photoUrl } });
    res.json({ success: true, photo: photoUrl });
  } catch(e) {
    console.log('Cloudinary upload error:', e.message);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// ===== CATERER UPLOAD PROFILE PHOTO — Cloudinary =====
app.post('/caterer-upload-profile-photo', requireCaterer, upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const catererUser = catererUsers.find(u => u.email === req.session.caterer.email);
  if (!catererUser) return res.status(404).json({ error: 'Caterer not found' });
  try {
    const photoUrl = await uploadToCloudinary(req.file.buffer, req.file.mimetype, 'bunyi/caterer-profiles');
    catererUser.photo = photoUrl; req.session.caterer.photo = photoUrl; req.session.save();
    const caterer = caterers.find(c => c.name === catererUser.businessName);
    if (caterer) caterer.photo = photoUrl;
    await mdb.collection('catererUsers').updateOne({ email: catererUser.email }, { $set: { photo: photoUrl } });
    await mdb.collection('caterers').updateOne({ name: catererUser.businessName }, { $set: { photo: photoUrl } }, { upsert: true });
    res.json({ success: true, photo: photoUrl });
  } catch(e) {
    console.log('Cloudinary upload error:', e.message);
    res.status(500).json({ error: 'Upload failed' });
  }
});

app.post('/account/update', requireLogin, async (req, res) => {
  const { name, email, gender, phone, address } = req.body;
  const oldEmail = req.session.user.email;
  const user = users.find(u => u.email === oldEmail);
  if (!user) return res.redirect('/login');
  user.name    = name    || user.name;
  user.email   = email;
  user.gender  = gender  || '';
  user.phone   = phone   || '';
  user.address = address || '';
  req.session.user.email = email;
  req.session.user.name  = user.name;
  try {
    await mdb.collection('users').updateOne(
      { email: oldEmail },
      { $set: { name: user.name, email: user.email, gender: user.gender, phone: user.phone, address: user.address } },
      { upsert: true }
    );
  } catch(e) { console.error('Update user failed:', e.message); }
  res.redirect('/account?saved=1');
});

app.get('/caterers', (req, res) => res.json(caterers));

app.post('/book', upload.single('receipt'), async (req, res) => {
  const { caterer, packageName, price, eventType, otherEvent, date, time,
          guests, paymentType, platform, otherPlatform, reference, grandTotal, sender } = req.body;
  const existing = bookings.find(b => b.caterer === caterer && b.date === date && b.time === time && b.sender === (req.session.user ? req.session.user.name : ''));
  if (existing) return res.redirect('/booking-success?caterer=' + encodeURIComponent(caterer) + '&status=' + encodeURIComponent(existing.status) + '&paymentType=' + (existing.amountPaid === existing.totalAmount ? 'full' : 'down') + '&date=' + date + '&bookingId=' + encodeURIComponent(existing.bookingId));
  const existingCount = bookings.filter(b => b.caterer === caterer && b.date === date && b.time === time).length;
  const maxAllowed = maxOrdersByBusiness[caterer] || 1;
  if (existingCount >= maxAllowed) {
    return res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Not Available</title>${sharedCSS}</head><body>${headerHTML('', req.session.user)}<div style="max-width:480px;margin:80px auto;padding:0 24px;text-align:center;"><div style="font-size:3rem;margin-bottom:16px;">❌</div><h2 style="font-size:1.4rem;font-weight:700;margin-bottom:10px;">Time Slot Not Available</h2><p style="color:var(--muted);margin-bottom:28px;font-size:0.92rem;">This schedule is already booked. Please select another time.</p><a class="btn-primary" href="/book?caterer=${encodeURIComponent(caterer)}&package=${encodeURIComponent(packageName)}&price=${price}">Go Back</a></div>${notifJS}</body></html>`);
  }
  const finalEvent = eventType === 'Other' ? otherEvent : eventType;
  const finalPlatform = platform === 'Other' ? (otherPlatform || 'Other') : platform;
  const guestCount = parseInt(guests) || 1;
  const pricePerHead = parseFloat(price) || 0;
  const total = parseFloat(grandTotal) || (guestCount * pricePerHead);
  const amountPaid = paymentType === 'full' ? total : total * 0.5;
  const status = paymentType === 'full' ? 'Fully Paid' : 'Partially Paid';
  const bookingId = 'BNY-' + Date.now().toString(36).toUpperCase();
  let receiptUrl = null;
  if (req.file) {
    try { receiptUrl = await uploadToCloudinary(req.file.buffer, req.file.mimetype, 'bunyi/receipts'); } catch(e) { console.log('Receipt upload error:', e.message); }
  }
  const newBooking = { bookingId, caterer, packageName, price: pricePerHead, eventType: finalEvent, date, time, guests: guestCount, totalAmount: total, amountPaid, status, receipt: receiptUrl, platform: finalPlatform, reference: reference || '', sender: sender || (req.session.user ? req.session.user.name : 'Customer'), verified: false, cartItems: (() => { try { return JSON.parse(req.body.cartItems || '[]'); } catch(e) { return []; } })(), createdAt: new Date() };
  bookings.push(newBooking);
  mdb.collection('bookings').insertOne(newBooking).then(r => {
    if (r) newBooking.id = r.insertedId.toString();
  }).catch(e => {});
  if (paymentType === 'full') { addNotification('booking', '🎉 Booking confirmed! Full payment received for your event on ' + date + '.'); addCatererNotification(caterer, 'booking', '📦 New booking received! Full payment from a customer for ' + (finalEvent || 'an event') + ' on ' + date + '.'); }
  else { addNotification('booking', '✅ Booking submitted! Down payment received for your event on ' + date + '. Remaining balance due 7 days before the event.'); addCatererNotification(caterer, 'booking', '📦 New booking received! Down payment from a customer for ' + (finalEvent || 'an event') + ' on ' + date + '.'); }
  return res.redirect('/booking-success?caterer=' + encodeURIComponent(caterer) + '&status=' + encodeURIComponent(status) + '&paymentType=' + paymentType + '&date=' + date + '&bookingId=' + encodeURIComponent(bookingId));
});

app.get('/payment', (req, res) => {
  const { caterer, package: pkg, price, date, time } = req.query;
  const eventDate = new Date(date); const today = new Date(); today.setHours(0, 0, 0, 0);
  const diffDays = (eventDate - today) / (1000 * 60 * 60 * 24);
  const withinWeek = diffDays <= 7;
  const paymentTermsItem = withinWeek ? `<li><strong>Full Payment Required</strong> — Your event is within 1 week. Payment must be completed in full upon booking.</li>` : `<li><strong>50% Down Payment</strong> — Event is more than 1 week away. Remaining 50% must be paid at least 1 week before the event.</li><li><strong>Full Payment</strong> — You may also opt to pay in full upon booking.</li>`;
  res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Payment – Bunyi Booking</title>${sharedCSS}<style>.main{max-width:660px;margin:0 auto;padding:40px 24px 80px;}.page-eyebrow{font-size:0.72rem;font-weight:600;color:var(--orange);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;}.page-title{font-size:1.7rem;font-weight:700;color:var(--dark);margin-bottom:28px;}.summary-bar{background:var(--dark);border-radius:10px;padding:18px 24px;display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px;}.s-label{font-size:0.68rem;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:3px;}.s-value{font-size:0.92rem;font-weight:600;color:#fff;}.s-value.orange{color:var(--orange);}.section-title{font-size:0.8rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid var(--border);}.form-group{margin-bottom:16px;}.form-row{display:grid;grid-template-columns:1fr 1fr;gap:14px;}.amount-row{background:var(--orange-light);border:1.5px solid #ffd0bc;border-radius:10px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;}.a-label{font-size:0.8rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;}.a-value{font-size:1.3rem;font-weight:700;color:var(--orange);}.divider{height:1px;background:var(--border);margin:22px 0;}.submit-btn{width:100%;padding:14px;background:var(--orange);color:var(--white);border:none;border-radius:8px;font-family:'Poppins',sans-serif;font-size:0.92rem;font-weight:700;cursor:pointer;}.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);z-index:1000;display:flex;align-items:center;justify-content:center;padding:1rem;}.modal{background:var(--white);border-radius:14px;width:100%;max-width:620px;max-height:88vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,0.3);}.modal-header{background:var(--dark);padding:20px 24px;flex-shrink:0;border-bottom:3px solid var(--orange);}.modal-eyebrow{font-size:0.68rem;font-weight:600;color:var(--orange);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;}.modal-header h2{font-size:1.3rem;font-weight:700;color:var(--white);}.modal-body{overflow-y:auto;padding:24px;flex:1;}.terms-section{margin-bottom:18px;}.section-num{display:inline-block;background:var(--orange);color:var(--white);font-size:0.65rem;font-weight:700;padding:2px 8px;border-radius:3px;margin-bottom:6px;}.terms-section h3{font-size:0.95rem;font-weight:700;color:var(--dark);margin-bottom:6px;}.terms-section p,.terms-section li{font-size:0.85rem;line-height:1.7;color:#555;}.terms-section ul{padding-left:16px;margin-top:6px;}.terms-section li{margin-bottom:4px;}.terms-section li strong{color:var(--dark);}.payment-note{background:#fff8f5;border-left:3px solid var(--orange);border-radius:0 6px 6px 0;padding:10px 14px;font-size:0.82rem;color:#666;margin-top:8px;font-style:italic;}.t-divider{border:none;border-top:1px solid var(--border);margin:16px 0;}.modal-footer{border-top:1px solid var(--border);padding:16px 24px 20px;background:var(--bg);flex-shrink:0;}.agree-row{display:flex;align-items:flex-start;gap:10px;margin-bottom:14px;}.agree-row input[type="checkbox"]{width:17px;height:17px;margin-top:2px;accent-color:var(--orange);cursor:pointer;flex-shrink:0;}.agree-row label{font-size:0.85rem;color:var(--muted);cursor:pointer;line-height:1.5;text-transform:none;letter-spacing:0;font-weight:400;}.agree-row label strong{color:var(--dark);}.modal-actions{display:flex;gap:10px;}.btn-decline{flex:1;padding:11px;background:transparent;color:var(--muted);border:1.5px solid var(--border);border-radius:8px;font-family:'Poppins',sans-serif;font-size:0.88rem;cursor:pointer;}.btn-accept{flex:2;padding:11px;background:var(--orange);color:var(--white);border:none;border-radius:8px;font-family:'Poppins',sans-serif;font-size:0.88rem;font-weight:700;cursor:pointer;opacity:0.4;pointer-events:none;}.btn-accept.active{opacity:1;pointer-events:auto;}@media(max-width:600px){.summary-bar{grid-template-columns:1fr 1fr;}.form-row{grid-template-columns:1fr;}.main{padding:28px 16px 60px;}}</style></head><body>
  ${headerHTML('payment', req.session.user)}
  <div class="modal-overlay" id="termsModal"><div class="modal"><div class="modal-header"><p class="modal-eyebrow">Before You Proceed</p><h2>Payment Terms &amp; Conditions</h2></div><div class="modal-body"><div class="terms-section"><span class="section-num">01</span><h3>Booking Confirmation</h3><p>All bookings are confirmed only upon successful payment.</p></div><hr class="t-divider"><div class="terms-section"><span class="section-num">02</span><h3>Payment Details</h3><p>Payment amount is automatically determined based on the event date:</p><ul>${paymentTermsItem}</ul><div class="payment-note">Failure to complete the required balance within the specified time may result in cancellation.</div></div><hr class="t-divider"><div class="terms-section"><span class="section-num">03</span><h3>Cancellation and Refund Policy</h3><p>Cancellation and refund policies are determined by the respective catering provider.</p></div><hr class="t-divider"><div class="terms-section"><span class="section-num">04</span><h3>Service Fulfillment</h3><p>BUNYI acts as a platform connecting customers with catering providers.</p></div><hr class="t-divider"><div class="terms-section"><span class="section-num">05</span><h3>Accuracy of Information</h3><p>Customers must ensure all provided details are accurate.</p></div><hr class="t-divider"><div class="terms-section"><span class="section-num">06</span><h3>Agreement and Consent</h3><p>By proceeding, you confirm you have read and agreed to these Terms and Conditions.</p></div></div><div class="modal-footer"><div class="agree-row"><input type="checkbox" id="agreeCheck" onchange="toggleAccept()"><label for="agreeCheck">I have read and agree to the <strong>Payment Terms and Conditions</strong> stated above.</label></div><div class="modal-actions"><button class="btn-decline" onclick="history.back()">Decline</button><button class="btn-accept" id="acceptBtn" onclick="acceptTerms()">I Agree &amp; Continue →</button></div></div></div></div>
  <main class="main" id="paymentPage" style="display:none;"><p class="page-eyebrow fade1">Payment</p><h1 class="page-title fade2">Complete Your Payment</h1><div class="summary-bar fade3"><div><div class="s-label">Caterer</div><div class="s-value">${caterer}</div></div><div><div class="s-label">Package</div><div class="s-value">${pkg}</div></div><div><div class="s-label">Event Date</div><div class="s-value">${date}</div></div><div><div class="s-label">Price / Head</div><div class="s-value orange">₱${price}</div></div></div>
  <form action="/pay" method="POST" enctype="multipart/form-data"><input type="hidden" name="caterer" value="${caterer}"><input type="hidden" name="date" value="${date}"><input type="hidden" name="time" value="${time}"><input type="hidden" name="price" value="${price}"><input type="hidden" name="guests" id="hiddenGuests"><div class="card fade4"><p class="section-title">Guest & Payment Info</p><div class="form-row"><div class="form-group"><label>Total Guests</label><input type="number" id="guestsInput" value="50" min="1"></div><div class="form-group"><label>Full Name</label><input name="sender" placeholder="Your full name" required></div></div><div class="form-group"><label>Payment Type</label><select name="paymentType" id="paymentType" ${withinWeek ? 'disabled' : ''}>${withinWeek ? '<option value="full">Full Payment (100%)</option>' : '<option value="down">Down Payment (50%)</option><option value="full">Full Payment (100%)</option>'}</select></div><div class="amount-row"><div class="a-label">Total Amount</div><div class="a-value" id="totalDisplay">₱0.00</div></div><div class="amount-row"><div class="a-label">Amount to Pay</div><div class="a-value" id="amountDisplay">₱0.00</div></div><div class="divider"></div><p class="section-title">Payment Details</p><div class="form-row"><div class="form-group"><label>Payment Platform</label><select name="platform" id="platformSelect" onchange="showOtherPlatform(this)"><option>GCash</option><option>Maya</option><option>Bank</option><option value="Other">Other</option></select></div><div class="form-group"><label>Reference Number</label><input name="reference" placeholder="e.g. 123456789" required></div></div><div class="form-group" id="otherPlatformBox" style="display:none;"><label>Specify Platform</label><input name="otherPlatform" id="otherPlatformInput" placeholder="e.g. PayMaya, Palawan, etc."></div><div class="form-group"><label>Upload Receipt</label><input type="file" name="receipt" required></div><button type="submit" class="submit-btn">Submit Payment →</button></div></form></main>
  <script>
    const price=${price};const guestsInput=document.getElementById('guestsInput');const paymentType=document.getElementById('paymentType');const hiddenGuests=document.getElementById('hiddenGuests');
    function updateTotal(){const guests=parseInt(guestsInput.value)||0;const total=guests*price;hiddenGuests.value=guests;const amount=paymentType.value==='down'?total*0.5:total;document.getElementById('totalDisplay').innerText='₱'+total.toLocaleString('en-PH',{minimumFractionDigits:2});document.getElementById('amountDisplay').innerText='₱'+amount.toLocaleString('en-PH',{minimumFractionDigits:2});}
    guestsInput.addEventListener('input',updateTotal);paymentType.addEventListener('change',updateTotal);updateTotal();
    function showOtherPlatform(select){const box=document.getElementById('otherPlatformBox');const input=document.getElementById('otherPlatformInput');if(select.value==='Other'){box.style.display='block';input.required=true;}else{box.style.display='none';input.required=false;}}
    function toggleAccept(){document.getElementById('acceptBtn').classList.toggle('active',document.getElementById('agreeCheck').checked);}
    function acceptTerms(){const modal=document.getElementById('termsModal');modal.style.display='none';modal.remove();document.getElementById('paymentPage').style.display='block';}
  <\/script>${notifJS}<script src='https://cdn.jotfor.ms/agent/embedjs/019e466996117451b02c25c833a184e8bfc4/embed.js?autoOpenChatIn=1'></script>
  </body></html>`);
});

app.post('/pay', upload.single('receipt'), async (req, res) => {
  const { caterer, date, time, paymentType, price, guests } = req.body;
  const booking = bookings.find(b => b.caterer === caterer && b.date === date && b.time === time);
  if (!booking) return res.send('Booking not found');
  booking.status = paymentType === 'full' ? 'Fully Paid' : 'Partially Paid';
  if (paymentType === 'full') { addNotification('booking', '💳 Your booking is fully paid!'); } else { addNotification('booking', '💳 Your payment is pending verification.'); }
  const total = guests * price; let paid = paymentType === 'down' ? total * 0.5 : total;
  booking.guests = guests; booking.totalAmount = total; booking.amountPaid = paid;
  if (req.file) {
    try { booking.receipt = await uploadToCloudinary(req.file.buffer, req.file.mimetype, 'bunyi/receipts'); } catch(e) { console.log('Receipt upload error:', e.message); }
  }
  res.redirect(`/result?status=${booking.status}&caterer=${encodeURIComponent(caterer)}`);
});

app.get('/result', (req, res) => {
  const { status, caterer } = req.query;
  const isFullyPaid = status === "Fully Paid";
  const statusColor = isFullyPaid ? "#16a34a" : "#d97706";
  const statusBg = isFullyPaid ? "#f0fdf4" : "#fffbeb";
  const statusBorder = isFullyPaid ? "#86efac" : "#fde68a";
  const subtitle = isFullyPaid ? "Your booking is confirmed and fully settled." : "Your down payment has been received. The remaining balance is due before the event. You will also receive a notification 2 days prior to the due date as a reminder.";
  res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Payment Successful – Bunyi Booking</title>${sharedCSS}<style>.main{max-width:520px;margin:0 auto;padding:60px 24px 80px;text-align:center;}.result-icon{width:72px;height:72px;border-radius:50%;background:${statusBg};border:2px solid ${statusBorder};display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:1.8rem;}.page-eyebrow{font-size:0.72rem;font-weight:600;color:var(--orange);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;}.page-title{font-size:1.7rem;font-weight:700;color:var(--dark);margin-bottom:10px;}.subtitle{font-size:0.9rem;color:var(--muted);margin-bottom:20px;line-height:1.6;}.status-badge{display:inline-flex;align-items:center;gap:8px;background:${statusBg};border:1.5px solid ${statusBorder};color:${statusColor};font-size:0.82rem;font-weight:700;padding:6px 16px;border-radius:100px;margin-bottom:28px;}.status-dot{width:8px;height:8px;border-radius:50%;background:${statusColor};}.info-card{background:var(--white);border:1px solid var(--border);border-radius:12px;padding:22px 24px;text-align:left;margin-bottom:24px;}.caterer-label{font-size:0.72rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;}.caterer-name{font-size:1.1rem;font-weight:700;color:var(--dark);margin-bottom:12px;}.info-divider{border:none;border-top:1px solid var(--border);margin:12px 0;}.info-card p{font-size:0.88rem;color:#666;line-height:1.7;}.actions{display:flex;gap:10px;}@media(max-width:600px){.actions{flex-direction:column;}.main{padding:40px 16px 60px;}}</style></head><body>
  ${headerHTML('', req.session.user)}
  <main class="main"><div class="result-icon fade1">${isFullyPaid ? '🎉' : '✅'}</div><p class="page-eyebrow fade1">Payment Received</p><h1 class="page-title fade2">Payment Successful!</h1><p class="subtitle fade2">${subtitle}</p><div class="status-badge fade3"><span class="status-dot"></span>${status}</div><div class="info-card fade3"><div class="caterer-label">Caterer</div><div class="caterer-name">${caterer}</div><hr class="info-divider"><p>Your payment has been submitted and the caterer has been notified. Please allow them within the day to verify your payment. You may message them for faster coordination.</p></div><div class="actions fade4"><a class="btn-primary" href="/message?caterer=${encodeURIComponent(caterer)}">💬 Message Caterer</a><a class="btn-secondary" href="/dashboard">Back to Dashboard</a></div></main>
  ${notifJS}<script src='https://cdn.jotfor.ms/agent/embedjs/019e466996117451b02c25c833a184e8bfc4/embed.js?autoOpenChatIn=1'></script>
  </body></html>`);
});

app.get('/messages', async (req, res) => {
  const { caterer, userEmail, userName } = req.query;
  try {
    const query = { caterer };
    if (userEmail) query.userEmail = userEmail;
    const msgs = await mdb.collection('messages').find(query).sort({ timestamp: 1 }).toArray();
    res.json(msgs.map(m => ({ ...m, id: m._id ? m._id.toString() : m.id })));
  } catch(e) {
    const fallback = messages.filter(m => m.caterer === caterer && (!userEmail || m.userEmail === userEmail));
    res.json(fallback);
  }
});

app.get('/chats', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'customer-messages.html')));

app.get('/message', (req, res) => {
  const { caterer } = req.query;
  res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Chat – Bunyi Booking</title>${sharedCSS}<style>body{display:flex;flex-direction:column;height:100vh;overflow:hidden;}.chat-wrapper{flex:1;display:flex;flex-direction:column;max-width:720px;width:100%;margin:0 auto;overflow:hidden;}.chat-topbar{padding:14px 20px;background:var(--white);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;flex-shrink:0;}.chat-avatar{width:38px;height:38px;border-radius:50%;background:var(--orange);color:var(--white);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1rem;flex-shrink:0;}.chat-caterer-name{font-size:0.95rem;font-weight:700;color:var(--dark);}.chat-status{font-size:0.75rem;color:var(--muted);}.chat-messages{flex:1;overflow-y:auto;padding:20px 16px;display:flex;flex-direction:column;gap:8px;background:var(--bg);}.empty-msg{text-align:center;color:var(--muted);font-size:0.88rem;margin:auto;}.msg-row{display:flex;flex-direction:column;max-width:72%;}.msg-row.me{align-self:flex-end;align-items:flex-end;}.msg-row.them{align-self:flex-start;align-items:flex-start;}.bubble{padding:10px 14px;border-radius:18px;font-size:0.9rem;line-height:1.5;word-break:break-word;}.msg-row.me .bubble{background:var(--orange);color:var(--white);border-bottom-right-radius:4px;}.msg-row.them .bubble{background:var(--white);color:var(--dark);border:1px solid var(--border);border-bottom-left-radius:4px;}.msg-time{font-size:0.68rem;color:var(--muted);margin-top:3px;padding:0 4px;}.chat-input-bar{display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--white);border-top:1px solid var(--border);flex-shrink:0;}.chat-input-bar input{flex:1;padding:11px 18px;border:1.5px solid var(--border);border-radius:24px;font-family:'Poppins',sans-serif;font-size:0.9rem;color:var(--dark);background:var(--bg);outline:none;}.chat-input-bar input:focus{border-color:var(--orange);}.send-btn{width:42px;height:42px;background:var(--orange);color:var(--white);border:none;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:1rem;flex-shrink:0;}.send-btn:hover{background:#c93a08;}.back-bar{padding:10px 16px;background:var(--white);border-bottom:1px solid var(--border);}.back-bar a{font-size:0.8rem;color:var(--muted);text-decoration:none;font-weight:500;}.back-bar a:hover{color:var(--orange);}</style></head><body>
  ${headerHTML('', req.session.user)}
  <div class="chat-wrapper"><div class="back-bar"><a href="/dashboard">← Back to Dashboard</a></div><div class="chat-topbar"><div class="chat-avatar">${caterer.charAt(0).toUpperCase()}</div><div><div class="chat-caterer-name">${caterer}</div><div class="chat-status">Catering Service</div></div></div><div class="chat-messages" id="chatBox"><p class="empty-msg">No messages yet. Start the conversation!</p></div><div class="chat-input-bar"><input type="text" id="msgInput" placeholder="Type a message..." maxlength="300"><button class="send-btn" onclick="sendMessage()" title="Send">➤</button></div></div>
  <script>
    const caterer='${caterer}';const currentUserName='${req.session.user ? req.session.user.name : 'Customer'}';
    function formatTime(ts){const d=new Date(ts);return d.toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'});}
    async function loadMessages(){const res=await fetch('/messages?caterer='+encodeURIComponent(caterer));const data=await res.json();const box=document.getElementById('chatBox');if(data.length===0){box.innerHTML='<p class="empty-msg">No messages yet. Start the conversation!</p>';return;}const wasAtBottom=box.scrollHeight-box.scrollTop<=box.clientHeight+60;box.innerHTML='';data.forEach(m=>{const isMe=m.sender===(currentUserName||'Customer');const div=document.createElement('div');div.className='msg-row '+(isMe?'me':'them');div.innerHTML='<div class="bubble">'+m.text+'</div><div class="msg-time">'+formatTime(m.timestamp)+'</div>';box.appendChild(div);});if(wasAtBottom)box.scrollTop=box.scrollHeight;}
    async function sendMessage(){const input=document.getElementById('msgInput');const text=input.value.trim();if(!text)return;await fetch('/send-message', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ caterer: activeCaterer, text }) });
    document.getElementById('msgInput').addEventListener('keydown',function(e){if(e.key==='Enter')sendMessage();});
    loadMessages();setInterval(loadMessages,2000);
  <\/script>${notifJS}<script src='https://cdn.jotfor.ms/agent/embedjs/019e466996117451b02c25c833a184e8bfc4/embed.js?autoOpenChatIn=1'></script>
  </body></html>`);
});

app.post('/send-message', async (req, res) => {
  const { caterer, text, userEmail: bodyUserEmail, senderName } = req.body;
  if (!caterer || !text) return res.status(400).json({ error: 'Missing fields' });
  const isCaterer = !!req.session.caterer;
  const userEmail = isCaterer
    ? (bodyUserEmail || null)
    : (req.session.user ? req.session.user.email : bodyUserEmail || null);
  const sender = isCaterer
    ? req.session.caterer.businessName
    : (req.session.user ? req.session.user.name : (senderName || 'Customer'));
  const chatId = userEmail ? userEmail.split('@')[0] + '_' + caterer.replace(/\s+/g, '_') : null;
  const newMsg = { caterer, sender, text, userEmail, chatId, timestamp: new Date() };
  try {
    const r = await mdb.collection('messages').insertOne(newMsg);
    newMsg.id = r.insertedId.toString();
    messages.push(newMsg);
  } catch(e) { messages.push(newMsg); }
  if (isCaterer) {
    addNotification('message', '💬 New message from ' + sender);
  } else {
    addCatererNotification(caterer, 'message', '💬 New message from ' + sender);
  }
  res.json({ success: true });
});

// booked-times moved below — now respects maxOrders per slot
app.get('/bookings', (req, res) => res.json(bookings));

app.post('/caterer-verify-booking', requireCaterer, async (req, res) => {
const { index } = req.body;
  const mine = bookings.filter(b => b.caterer === req.session.caterer.businessName);
  const booking = mine[parseInt(index)];
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  booking.verified = true;
  try {
    const { ObjectId } = require('mongodb');
    await mdb.collection('bookings').updateOne({ _id: new ObjectId(booking.id) }, { $set: { verified: true } });
  } catch(e) {}
  addNotification('verify', '\u2705 Your payment for ' + booking.caterer + ' on ' + booking.date + ' has been verified!');
  res.json({ success: true });
});

// ── VERIFY REMAINING BALANCE PAYMENT (final verification) ──
app.post('/caterer-verify-remaining', requireCaterer, async (req, res) => {
const { index } = req.body;
  const mine = bookings.filter(b => b.caterer === req.session.caterer.businessName);
  const booking = mine[parseInt(index)];
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  booking.verified = true;
  booking.status = 'Fully Paid';
  booking.amountPaid = booking.totalAmount;
  booking.receipt2confirmed = true;
  try {
    const { ObjectId } = require('mongodb');
    await mdb.collection('bookings').updateOne({ _id: new ObjectId(booking.id) }, { $set: { verified: true, status: 'Fully Paid', amountPaid: booking.totalAmount, receipt2confirmed: true } });
  } catch(e) {}
  addNotification('verify', '\u2705 Your remaining balance for ' + booking.caterer + ' on ' + booking.date + ' has been verified! Your booking is now fully paid.');
  res.json({ success: true });
});

app.get('/chats-data', async (req, res) => {
  const userEmail = req.session.user ? req.session.user.email : null;
  const userName = req.session.user ? req.session.user.name : null;
  if (!userEmail) return res.json([]);
  try {
    const msgs = await mdb.collection('messages').find({ userEmail }).sort({ timestamp: 1 }).toArray();
    const catererSet = new Set();
    msgs.forEach(m => { if (m.caterer) catererSet.add(m.caterer); });
    const conversations = [];
    for (const catererName of catererSet) {
      const thread = await mdb.collection('messages').find({ caterer: catererName, userEmail }).sort({ timestamp: -1 }).limit(1).toArray();
      if (thread.length > 0) {
        conversations.push({ caterer: catererName, lastMessage: thread[0].text, lastTime: thread[0].timestamp });
      }
    }
    conversations.sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));
    res.json(conversations);
  } catch(e) { res.json([]); }
});

app.get('/session-user', (req, res) => { if (!req.session.user) return res.json(null); const user = users.find(u => u.email === req.session.user.email); res.json({ ...req.session.user, photo: user ? user.photo : null }); });
app.get('/reviews', (req, res) => { const { caterer } = req.query; if (caterer) return res.json(reviews.filter(r => r.caterer === caterer)); res.json(reviews); });

app.post('/reviews', async (req, res) => {
  const { caterer, rating, comment } = req.body;
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  const user = req.session.user;
  const eligible = bookings.find(b => b.caterer === caterer && b.status === 'Fully Paid');
  if (!eligible) return res.status(403).json({ error: 'You can only review caterers you have fully paid bookings with.' });
  const already = reviews.find(r => r.caterer === caterer && r.userName === user.name);
  if (already) return res.status(400).json({ error: 'You have already reviewed this caterer.' });
  const newReview = { id: reviewIdCounter++, caterer, userName: user.name, rating: parseInt(rating), comment, createdAt: new Date() };
  reviews.push(newReview);
  await mdb.collection('reviews').insertOne(newReview);
  res.json({ success: true });
});

app.get('/notifications', (req, res) => { res.json([...notifications].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))); });
app.post('/add-notification', (req, res) => { const { type, text } = req.body; if (!type || !text) return res.status(400).json({ error: 'Missing fields' }); addNotification(type, text); res.json({ success: true }); });
app.post('/read-notifications', (req, res) => { notifications.forEach(n => n.isRead = true); res.json({ success: true }); });

app.post('/read-notification', async (req, res) => {
  const { id } = req.body;
  const n = notifications.find(n => n.id == id);
  if (n) {
    n.isRead = true;
    try {
      const { ObjectId } = require('mongodb');
      await mdb.collection('notifications').updateOne({ _id: new ObjectId(id) }, { $set: { isRead: true } });
    } catch(e) {}
  }
  res.json({ ok: true });
});

app.post('/caterer-read-notification', async (req, res) => {
  if (!req.session.caterer) return res.json({ ok: true });
  const { id } = req.body;
  const notes = catererNotifications[req.session.caterer.businessName] || [];
  const n = notes.find(n => String(n.id) === String(id) || String(n._id) === String(id));
  if (n) {
    n.isRead = true;
    try {
      await mdb.collection('catererNotifications').updateOne(
        { businessName: req.session.caterer.businessName },
        { $set: { items: notes } }
      );
    } catch(e) {}
  }
  res.json({ ok: true });
});

app.get('/cart', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'customer-checkout.html')));
app.get('/booking-success', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'customer-booking-success.html')));
app.get('/events', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'customer-bookings.html')));
app.get('/payments', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'customer-payments.html')));
app.get('/bookings-page', requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'customer-bookings-page.html')));

// ===== CATERER ACCOUNT =====
app.get('/caterer-account', requireCaterer, (req, res) => {
  const catererUser = catererUsers.find(u => u.email === req.session.caterer.email);
  if (!catererUser) return res.redirect('/caterer-login');
  const tab = req.query.tab || 'info';

  res.send(`
    <!DOCTYPE html><html lang="en"><head>
      <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>My Account – Bunyi Caterer</title>
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
      <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root { --orange: #E8450A; --orange-light: #fff0eb; --dark: #1A1A1A; --white: #fff; --bg: #f8f8f8; --border: #e8e8e8; --muted: #888; --text: #333; --green: #16a34a; --green-light: #f0fdf4;
          --crimson: #D72638; --crimson-mid: #b01e2d; --crimson-light: #fde8eb;
          --yellow: #F7B731; --tangerine: #F26419;
        }
        body { font-family: 'Poppins', sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; }
        .color-strip { height: 4px; background: linear-gradient(90deg, var(--crimson), var(--tangerine), var(--yellow)); }
        .header { background: var(--dark); padding: 0 40px; height: 62px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 200; box-shadow: 0 2px 12px rgba(215,38,56,0.3); }
        .header-brand { font-size: 1.25rem; font-weight: 700; color: var(--white); letter-spacing: -0.01em; text-decoration: none; }
        .header-brand span { color: var(--crimson); }
        .header-nav { display: flex; align-items: center; gap: 4px; }
        .nav-link { color: #aaa; text-decoration: none; font-size: 0.82rem; font-weight: 500; padding: 6px 12px; border-radius: 6px; transition: color 0.2s, background 0.2s; white-space: nowrap; }
        .nav-link:hover, .nav-link.active { color: var(--white); background: rgba(255,255,255,0.18); }
        .header-right { display: flex; align-items: center; gap: 6px; }
        .notif-wrapper { position: relative; }
        .notif-btn { background: rgba(255,255,255,0.08); border: none; cursor: pointer; width: 38px; height: 38px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #ccc; font-size: 1rem; position: relative; transition: background 0.2s; }
        .notif-btn:hover { background: rgba(255,255,255,0.14); color: var(--white); }
        .notif-badge { position: absolute; top: -3px; right: -3px; background: var(--yellow); color: var(--dark); font-size: 0.55rem; font-weight: 700; border-radius: 999px; padding: 2px 5px; min-width: 16px; text-align: center; display: none; }
        .notif-dropdown { display: none; position: absolute; right: 0; top: 46px; width: 310px; background: var(--white); border: 1px solid var(--border); border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.14); z-index: 999; overflow: hidden; }
        .notif-dropdown.open { display: block; }
        .notif-header-row { padding: 14px 16px 10px; border-bottom: 1px solid var(--border); background: var(--bg); flex-shrink: 0; }
        .notif-title { font-size: 0.88rem; font-weight: 600; color: var(--dark); }
        .notif-empty { padding: 24px 16px; font-size: 0.83rem; color: var(--muted); text-align: center; }
        .notif-scroll { max-height: 280px; overflow-y: auto; }
        .notif-item { padding: 12px 16px; border-bottom: 1px solid var(--border); text-decoration: none; display: block; transition: background 0.15s; }
        .notif-item:last-child { border-bottom: none; }
        .notif-item:hover { background: var(--bg); }
        .notif-item.unread { background: var(--crimson-light); }
        .notif-text { font-size: 0.83rem; color: var(--text); line-height: 1.4; }
        .notif-item.unread .notif-text { font-weight: 600; color: var(--dark); }
        .notif-time { font-size: 0.7rem; color: var(--muted); margin-top: 3px; }
        .profile-wrapper { position: relative; }
        .profile-btn { background: rgba(255,255,255,0.08); border: none; cursor: pointer; height: 38px; border-radius: 8px; padding: 0 12px; display: flex; align-items: center; gap: 8px; color: #ccc; font-size: 0.82rem; font-weight: 500; font-family: 'Poppins', sans-serif; transition: background 0.2s; }
        .profile-btn:hover { background: rgba(255,255,255,0.14); color: var(--white); }
        .profile-avatar { width: 26px; height: 26px; border-radius: 50%; background: rgba(255,255,255,0.25); color: var(--white); display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; flex-shrink: 0; border: 1.5px solid rgba(255,255,255,0.5); overflow: hidden; }
        .profile-chevron { font-size: 0.6rem; opacity: 0.6; }
        .profile-dropdown { display: none; position: absolute; right: 0; top: 46px; width: 200px; background: var(--white); border: 1px solid var(--border); border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.14); z-index: 999; overflow: hidden; }
        .profile-dropdown.open { display: block; }
        .profile-info { padding: 14px 16px 12px; border-bottom: 1px solid var(--border); background: var(--bg); }
        .profile-name { font-size: 0.88rem; font-weight: 700; color: var(--dark); }
        .profile-email { font-size: 0.72rem; color: var(--muted); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .profile-menu-item { display: flex; align-items: center; gap: 10px; padding: 11px 16px; text-decoration: none; font-size: 0.83rem; color: var(--text); font-weight: 500; transition: background 0.15s; }
        .profile-menu-item:hover { background: var(--bg); }
        .profile-menu-item.logout { color: var(--crimson-mid); border-top: 1px solid var(--border); }
        .profile-menu-item.logout:hover { background: var(--crimson-light); }
        .hamburger-btn { display: none !important; background: rgba(255,255,255,0.08); border: none; cursor: pointer; width: 38px; height: 38px; border-radius: 8px; flex-direction: column; align-items: center; justify-content: center; gap: 5px; transition: background 0.2s; }
        .hamburger-btn:hover { background: rgba(255,255,255,0.14); }
        .hamburger-btn span { display: block; width: 18px; height: 2px; background: #ccc; border-radius: 2px; }
        .mobile-nav { display: none; position: fixed; top: 66px; left: 0; right: 0; background: var(--dark); z-index: 199; padding: 8px 16px 12px; border-bottom: 1px solid rgba(255,255,255,0.1); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
        .mobile-nav.open { display: block; }
        .mobile-nav a { display: block; color: #aaa; text-decoration: none; font-size: 0.9rem; font-weight: 500; padding: 12px 14px; border-radius: 8px; transition: color 0.2s, background 0.2s; }
        .mobile-nav a:hover, .mobile-nav a.active { color: var(--white); background: rgba(255,255,255,0.18); }
        @media (max-width: 780px) { .header { padding: 0 16px; } .header-nav { display: none !important; } .hamburger-btn { display: flex !important; } }
        @media (max-width: 600px) { .form-row { grid-template-columns: 1fr; } .main { padding: 28px 16px 60px; } }
        .main { max-width: 680px; margin: 0 auto; padding: 40px 24px 80px; }
        .back-link { display: inline-flex; align-items: center; gap: 6px; font-size: 0.8rem; color: var(--muted); text-decoration: none; margin-bottom: 20px; transition: color 0.2s; }
        .back-link:hover { color: var(--orange); }
        .page-eyebrow { font-size: 0.7rem; font-weight: 600; color: var(--orange); text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 4px; }
        .page-title { font-size: 1.4rem; font-weight: 700; color: var(--dark); margin-bottom: 20px; }
        .profile-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
        .profile-avatar-lg { width: 56px; height: 56px; border-radius: 50%; background: var(--orange); color: var(--white); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 700; flex-shrink: 0; }
        .profile-header-name { font-size: 1.05rem; font-weight: 700; color: var(--dark); }
        .profile-header-email { font-size: 0.78rem; color: var(--muted); margin-top: 2px; }
        .tabs { display: flex; background: var(--white); border: 1px solid var(--border); border-radius: 10px; padding: 4px; gap: 4px; margin-bottom: 24px; }
        .tab-btn { flex: 1; padding: 10px 12px; border: none; border-radius: 7px; font-family: 'Poppins', sans-serif; font-size: 0.84rem; font-weight: 600; cursor: pointer; transition: all 0.2s; color: var(--muted); background: transparent; text-decoration: none; text-align: center; display: block; }
        .tab-btn.active { background: var(--orange); color: var(--white); }
        .card { background: var(--white); border: 1px solid var(--border); border-radius: 12px; padding: 22px 24px; margin-bottom: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
        .section-label { font-size: 0.7rem; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 14px; padding-bottom: 8px; border-bottom: 1px solid var(--border); }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .form-group { margin-bottom: 16px; }
        label { display: block; font-size: 0.7rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
        .read-field { padding: 10px 13px; background: var(--bg); border: 1.5px solid var(--border); border-radius: 8px; font-size: 0.9rem; color: var(--dark); font-family: 'Poppins', sans-serif; }
        input, textarea, select { width: 100%; padding: 10px 13px; border: 1.5px solid var(--border); border-radius: 8px; font-family: 'Poppins', sans-serif; font-size: 0.9rem; color: var(--dark); background: var(--white); outline: none; transition: border-color 0.2s; }
        input:focus, textarea:focus, select:focus { border-color: var(--orange); box-shadow: 0 0 0 3px rgba(232,69,10,0.08); }
        textarea { resize: vertical; min-height: 80px; }
        .save-btn { width: 100%; padding: 12px; background: var(--orange); color: var(--white); border: none; border-radius: 8px; font-family: 'Poppins', sans-serif; font-size: 0.92rem; font-weight: 700; cursor: pointer; transition: background 0.2s; margin-top: 8px; }
        .save-btn:hover { background: #c93a08; }
        .success-msg { background: var(--green-light); border: 1px solid #86efac; border-radius: 8px; padding: 10px 14px; font-size: 0.84rem; color: var(--green); margin-bottom: 16px; font-weight: 500; }
        .error-msg-box { background: var(--orange-light); border: 1px solid #ffd0bc; border-radius: 8px; padding: 10px 14px; font-size: 0.84rem; color: #c93a08; margin-bottom: 16px; font-weight: 500; }
        .setting-row { display: flex; align-items: center; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid var(--border); }
        .setting-row:last-child { border-bottom: none; }
        .setting-label { font-size: 0.88rem; font-weight: 600; color: var(--dark); }
        .setting-sub { font-size: 0.75rem; color: var(--muted); margin-top: 2px; }
        .toggle { width: 44px; height: 24px; border-radius: 999px; background: var(--border); border: none; cursor: pointer; position: relative; transition: background 0.2s; flex-shrink: 0; }
        .toggle::after { content: ''; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: var(--white); transition: transform 0.2s; box-shadow: 0 1px 4px rgba(0,0,0,0.18); }
        .toggle.on { background: var(--orange); }
        .toggle.on::after { transform: translateX(20px); }
        .divider { height: 1px; background: var(--border); margin: 4px 0 14px; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { opacity: 0; animation: fadeUp 0.4s ease forwards; }
        @media (max-width: 600px) { .form-row { grid-template-columns: 1fr; } .main { padding: 28px 16px 60px; } }
      </style>
    </head>
    <body>
      <div class="color-strip"></div>
      <div class="mobile-nav" id="mobileNav">
        <a href="/caterer-dashboard">Dashboard</a>
        <a href="/caterer-bookings">Bookings</a>
        <a href="/caterer-products">Products</a>
        <a href="/caterer-messages">Messages</a>
      </div>
      <header class="header">
        <a class="header-brand" href="/caterer-dashboard">Bunyi<span>.</span></a>
        <nav class="header-nav">
          <a class="nav-link" href="/caterer-dashboard">Dashboard</a>
          <a class="nav-link" href="/caterer-bookings">Bookings</a>
          <a class="nav-link" href="/caterer-products">Products</a>
          <a class="nav-link" href="/caterer-messages">Messages</a>
        </nav>
        <div class="header-right">
          <button class="hamburger-btn" onclick="toggleMobileNav()" id="hamburgerBtn">
            <span></span><span></span><span></span>
          </button>
          <div class="notif-wrapper">
            <button class="notif-btn" onclick="toggleNotifDropdown()" title="Notifications">🔔 <span class="notif-badge" id="notifBadge" style="display:none;">0</span></button>
            <div class="notif-dropdown" id="notifDropdown">
              <div class="notif-header-row"><span class="notif-title">Notifications</span></div>
              <div class="notif-scroll" id="notifList"><p class="notif-empty">No notifications yet.</p></div>
            </div>
          </div>
          <div class="profile-wrapper">
            <button class="profile-btn" onclick="toggleProfileDropdown()">
              <div class="profile-avatar" style="${catererUser.photo ? 'background:none;padding:0;overflow:hidden;' : ''}">${catererUser.photo ? `<img src="${catererUser.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : catererUser.businessName.charAt(0).toUpperCase()}</div>
              <span class="profile-chevron">▼</span>
            </button>
            <div class="profile-dropdown" id="profileDropdown">
              <div class="profile-info">
                <div class="profile-name">${catererUser.businessName}</div>
                <div class="profile-email">${catererUser.email}</div>
              </div>
              <a class="profile-menu-item" href="/caterer-account">⚙️ My Account</a>
              <a class="profile-menu-item logout" href="/caterer-logout">🚪 Logout</a>
            </div>
          </div>
        </div>
      </header>
      <main class="main">
        <a href="/caterer-dashboard" class="back-link">← Back to Dashboard</a>
        <p class="page-eyebrow">Profile</p>
        <h1 class="page-title">My Account</h1>
        <div class="profile-header fade-in">
          <div class="profile-avatar-lg" id="bigAvatar" style="${catererUser.photo ? 'background:none;padding:0;overflow:hidden;' : ''}">
            ${catererUser.photo ? `<img src="${catererUser.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : catererUser.businessName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div class="profile-header-name">${catererUser.businessName}</div>
            <div class="profile-header-email">${catererUser.email}</div>
            <label for="photoUpload" style="display:inline-block;margin-top:8px;padding:6px 14px;background:#fff0eb;color:#E8450A;border-radius:8px;font-size:0.76rem;font-weight:600;cursor:pointer;border:1.5px solid rgba(232,69,10,0.2);text-transform:none;letter-spacing:0;">📷 Change Photo</label>
            <input type="file" id="photoUpload" accept="image/*" style="display:none;" onchange="uploadPhoto(this)">
            <div id="photoMsg" style="font-size:0.74rem;margin-top:4px;color:#16a34a;"></div>
          </div>
        </div>
        <div class="tabs fade-in">
          <a href="/caterer-account?tab=info" class="tab-btn ${tab === 'info' ? 'active' : ''}">Business Information</a>
          <a href="/caterer-account?tab=settings" class="tab-btn ${tab === 'settings' ? 'active' : ''}">Settings & Privacy</a>
        </div>
        ${tab === 'info' ? `
        <div class="card fade-in">
          ${req.query.saved === '1' ? '<div class="success-msg">✅ Changes saved successfully.</div>' : ''}
          <p class="section-label">Business Information</p>
          <div class="form-row" style="margin-bottom:16px;">
            <div class="form-group"><label>Business Name</label><div class="read-field">${catererUser.businessName}</div></div>
            <div class="form-group"><label>Contact Number</label><div class="read-field">${catererUser.contactNumber || '—'}</div></div>
          </div>
          <div class="form-group"><label>Business Address</label><div class="read-field">${catererUser.businessAddress || '—'}</div></div>
        </div>
        ` : `
        <div class="card fade-in">
          ${req.query.pwsaved === '1' ? '<div class="success-msg">✅ Password updated successfully.</div>' : ''}
          ${req.query.pwerror === 'wrong' ? '<div class="error-msg-box">❌ Current password is incorrect.</div>' : ''}
          ${req.query.pwerror === 'short' ? '<div class="error-msg-box">❌ New password must be at least 6 characters.</div>' : ''}
          ${req.query.pwerror === 'mismatch' ? '<div class="error-msg-box">❌ Passwords do not match.</div>' : ''}
          ${req.query.delerror === 'wrong' ? '<div class="error-msg-box">❌ Incorrect password. Account not deleted.</div>' : ''}
          <p class="section-label">Notifications</p>
          <div class="setting-row"><div><div class="setting-label">Booking Alerts</div><div class="setting-sub">Get notified when a new booking is received</div></div><button class="toggle on" onclick="this.classList.toggle('on')"></button></div>
          <div class="setting-row"><div><div class="setting-label">Payment Updates</div><div class="setting-sub">Get notified when a customer pays</div></div><button class="toggle on" onclick="this.classList.toggle('on')"></button></div>
          <div class="setting-row"><div><div class="setting-label">New Messages</div><div class="setting-sub">Get notified when a customer sends you a message</div></div><button class="toggle on" onclick="this.classList.toggle('on')"></button></div>
          <div class="divider"></div>
          <p class="section-label">Account</p>
          <div class="setting-row"><div><div class="setting-label">Change Password</div><div class="setting-sub">Update your account password</div></div><button onclick="document.getElementById('changePwModal').style.display='flex'" style="font-size:0.82rem;font-weight:600;color:var(--orange);background:none;border:none;cursor:pointer;font-family:'Poppins',sans-serif;">Change →</button></div>
          <div class="setting-row"><div><div class="setting-label" style="color:#e53e3e;">Delete Account</div><div class="setting-sub">Permanently remove your account and data</div></div><button onclick="document.getElementById('deleteAcctModal').style.display='flex'" style="font-size:0.82rem;font-weight:600;color:#e53e3e;background:none;border:none;cursor:pointer;font-family:'Poppins',sans-serif;">Delete →</button></div>
        </div>
        <div id="changePwModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);z-index:9999;align-items:center;justify-content:center;padding:20px;"><div style="background:#fff;border-radius:14px;width:100%;max-width:440px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.25);"><div style="background:#1A1A1A;padding:20px 24px;display:flex;align-items:center;justify-content:space-between;"><div><div style="font-size:0.68rem;font-weight:600;color:#E8450A;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:3px;">Security</div><div style="font-size:1.1rem;font-weight:700;color:#fff;">Change Password</div></div><button onclick="document.getElementById('changePwModal').style.display='none'" style="background:rgba(255,255,255,0.1);border:none;color:#fff;font-size:1.1rem;width:32px;height:32px;border-radius:50%;cursor:pointer;">✕</button></div><form action="/caterer-account/change-password" method="POST" style="padding:24px;"><div style="margin-bottom:14px;"><label>Current Password</label><input type="password" name="currentPassword" required placeholder="Enter current password"></div><div style="margin-bottom:14px;"><label>New Password</label><input type="password" name="newPassword" required placeholder="Minimum 6 characters"></div><div style="margin-bottom:22px;"><label>Confirm New Password</label><input type="password" name="confirmPassword" required placeholder="Repeat new password"></div><div style="display:flex;gap:10px;"><button type="button" onclick="document.getElementById('changePwModal').style.display='none'" style="flex:1;padding:11px;background:transparent;color:#888;border:1.5px solid #e8e8e8;border-radius:8px;font-family:'Poppins',sans-serif;font-size:0.88rem;cursor:pointer;">Cancel</button><button type="submit" style="flex:2;padding:11px;background:#E8450A;color:#fff;border:none;border-radius:8px;font-family:'Poppins',sans-serif;font-size:0.88rem;font-weight:700;cursor:pointer;">Update Password</button></div></form></div></div>
        <div id="deleteAcctModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);z-index:9999;align-items:center;justify-content:center;padding:20px;"><div style="background:#fff;border-radius:14px;width:100%;max-width:440px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.25);"><div style="background:#1A1A1A;padding:20px 24px;display:flex;align-items:center;justify-content:space-between;"><div><div style="font-size:0.68rem;font-weight:600;color:#e53e3e;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:3px;">Danger Zone</div><div style="font-size:1.1rem;font-weight:700;color:#fff;">Delete Account</div></div><button onclick="document.getElementById('deleteAcctModal').style.display='none'" style="background:rgba(255,255,255,0.1);border:none;color:#fff;font-size:1.1rem;width:32px;height:32px;border-radius:50%;cursor:pointer;">✕</button></div><div style="padding:24px;"><p style="font-size:0.88rem;color:#555;line-height:1.6;margin-bottom:20px;font-family:'Poppins',sans-serif;">This will <strong>permanently delete</strong> your caterer account and all data. This action <strong>cannot be undone</strong>.</p><form action="/caterer-account/delete" method="POST"><div style="margin-bottom:20px;"><label>Enter your password to confirm</label><input type="password" name="password" required placeholder="Your password"></div><div style="display:flex;gap:10px;"><button type="button" onclick="document.getElementById('deleteAcctModal').style.display='none'" style="flex:1;padding:11px;background:transparent;color:#888;border:1.5px solid #e8e8e8;border-radius:8px;font-family:'Poppins',sans-serif;font-size:0.88rem;cursor:pointer;">Cancel</button><button type="submit" style="flex:2;padding:11px;background:#e53e3e;color:#fff;border:none;border-radius:8px;font-family:'Poppins',sans-serif;font-size:0.88rem;font-weight:700;cursor:pointer;">Yes, Delete My Account</button></div></form></div></div></div>
        `}
      </main>
      <script>
        function toggleProfileDropdown() { document.getElementById('profileDropdown').classList.toggle('open'); document.getElementById('notifDropdown').classList.remove('open'); }
        async function toggleNotifDropdown() { const dd = document.getElementById('notifDropdown'); document.getElementById('profileDropdown').classList.remove('open'); dd.classList.toggle('open'); if (dd.classList.contains('open')) { await loadNotifications(); } }
        function formatNotifTime(ts) { var d = new Date(ts); return d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) + ' · ' + d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }); }
        async function loadNotifications() {
          try {
            var res = await fetch('/caterer-notifications');
            var data = await res.json();
            var badge = document.getElementById('notifBadge');
            var list = document.getElementById('notifList');
            var unread = data.filter(function(n) { return !n.isRead; }).length;
            badge.style.display = unread > 0 ? 'inline-block' : 'none';
            badge.textContent = unread;
            if (data.length === 0) { list.innerHTML = '<p class="notif-empty">No notifications yet.</p>'; return; }
            list.innerHTML = '';
            data.forEach(function(n) {
              var a = document.createElement('a');
              a.className = 'notif-item' + (n.isRead ? '' : ' unread');
              a.href = '#';
              a.onclick = function(e) {
                e.preventDefault();
                fetch('/caterer-read-notification', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id: n.id })
                })
                  .then(function() { 
                    var text = (n.text || '').toLowerCase();
                    if (text.includes('payment') || text.includes('verify')) { window.location.href = '/caterer-bookings?filter=pending'; }
                    else if (text.includes('booking')) { window.location.href = '/caterer-bookings'; }
                    else if (text.includes('message') || text.includes('chat')) { window.location.href = '/caterer-messages'; }
                    else { window.location.href = '/caterer-dashboard'; }
                  });
              };
              a.innerHTML = '<div class="notif-text">' + n.text + '</div><div class="notif-time">' + formatNotifTime(n.createdAt) + '</div>';
              list.appendChild(a);
            });
          } catch(e) {}
        }
        document.addEventListener('click', function(e) {
          var nw = document.querySelector('.notif-wrapper'); if (nw && !nw.contains(e.target)) document.getElementById('notifDropdown').classList.remove('open');
          var pw = document.querySelector('.profile-wrapper'); if (pw && !pw.contains(e.target)) document.getElementById('profileDropdown').classList.remove('open');
          var nav = document.getElementById('mobileNav'); var btn = document.getElementById('hamburgerBtn');
          if (nav && btn && !nav.contains(e.target) && !btn.contains(e.target)) nav.classList.remove('open');
        });

        function toggleMobileNav(){document.getElementById('mobileNav').classList.toggle('open');}
        loadNotifications(); setInterval(loadNotifications, 5000);
        async function uploadPhoto(input) { if (!input.files[0]) return; const formData = new FormData(); formData.append('photo', input.files[0]); try { const res = await fetch('/caterer-upload-profile-photo', { method: 'POST', body: formData }); const data = await res.json(); if (data.success) { document.getElementById('photoMsg').textContent = '✅ Photo updated!'; const big = document.getElementById('bigAvatar'); big.style.background = 'none'; big.style.padding = '0'; big.style.overflow = 'hidden'; big.innerHTML = '<img src="' + data.photo + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">'; } } catch(e) { document.getElementById('photoMsg').textContent = '❌ Upload failed.'; } }
      </script>
      <script src='https://cdn.jotfor.ms/agent/embedjs/019e466996117451b02c25c833a184e8bfc4/embed.js'></script>
    </body></html>
  `);
});

app.post('/caterer-account/update', requireCaterer, async (req, res) => {
  const { email, businessName, businessAddress, contactNumber, description } = req.body;
  const oldEmail = req.session.caterer.email;
  const user = catererUsers.find(u => u.email === oldEmail);
  if (!user) return res.redirect('/caterer-login');
  const oldBusinessName = user.businessName;
  user.email           = email;
  user.businessName    = businessName    || user.businessName;
  user.businessAddress = businessAddress || '';
  user.contactNumber   = contactNumber   || '';
  user.description     = description     || '';
  req.session.caterer.email        = email;
  req.session.caterer.businessName = user.businessName;
  const caterer = caterers.find(c => c.name === oldBusinessName);
  if (caterer) { caterer.name = user.businessName; caterer.location = user.businessAddress; caterer.description = user.description; }
  try {
    await mdb.collection('catererUsers').updateOne(
      { email: oldEmail },
      { $set: { email: user.email, businessName: user.businessName, businessAddress: user.businessAddress, contactNumber: user.contactNumber, description: user.description } },
      { upsert: true }
    );
    await mdb.collection('caterers').updateOne(
      { name: oldBusinessName },
      { $set: { name: user.businessName, location: user.businessAddress, description: user.description } },
      { upsert: true }
    );
  } catch(e) { console.error('Caterer update failed:', e.message); }
  res.redirect('/caterer-account?tab=info&saved=1');
});

app.post('/caterer-account/change-password', requireCaterer, async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const user = catererUsers.find(u => u.email === req.session.caterer.email);
  if (!user) return res.redirect('/caterer-login');
  if (user.password !== currentPassword) return res.redirect('/caterer-account?tab=settings&pwerror=wrong');
  if (newPassword.length < 6) return res.redirect('/caterer-account?tab=settings&pwerror=short');
  if (newPassword !== confirmPassword) return res.redirect('/caterer-account?tab=settings&pwerror=mismatch');
  user.password = newPassword;
  try {
    await mdb.collection('catererUsers').updateOne({ email: user.email }, { $set: { password: newPassword } });
  } catch(e) { console.error('Change caterer password failed:', e.message); }
  res.redirect('/caterer-account?tab=settings&pwsaved=1');
});

app.post('/caterer-account/delete', requireCaterer, (req, res) => { const { password } = req.body; const idx = catererUsers.findIndex(u => u.email === req.session.caterer.email); if (idx === -1) return res.redirect('/caterer-login'); if (catererUsers[idx].password !== password) return res.redirect('/caterer-account?tab=settings&delerror=wrong'); catererUsers.splice(idx, 1); req.session.caterer = null; res.redirect('/caterer-login'); });

app.post('/caterer-package/add', requireCaterer, upload.single('image'), async (req, res) => {
  const { name, category, price, inclusions } = req.body;
  const caterer = caterers.find(c => c.name === req.session.caterer.businessName);
  if (!caterer) return res.status(404).json({ error: 'Caterer not found' });
  if (!name) return res.status(400).json({ error: 'Name is required' });
  let imagePath = null;
  if (req.file) {
    try { imagePath = await uploadToCloudinary(req.file.buffer, req.file.mimetype, 'bunyi/packages'); } catch(e) { console.log('Image upload error:', e.message); }
  }
  let variants = [];
  const variantNames = req.body.variantNames ? (Array.isArray(req.body.variantNames) ? req.body.variantNames : [req.body.variantNames]) : [];
  const variantPrices = req.body.variantPrices ? (Array.isArray(req.body.variantPrices) ? req.body.variantPrices : [req.body.variantPrices]) : [];
  variantNames.forEach((vname, i) => { if (vname.trim()) { variants.push({ name: vname.trim(), price: parseFloat(variantPrices[i]) || 0 }); } });
  caterer.packages.push({ name, category: category || 'Packages', price: variants.length > 0 ? 0 : parseFloat(price) || 0, inclusions: inclusions || '', image: imagePath, variants });
  await mdb.collection('caterers').updateOne({ name: caterer.name }, { $set: { packages: caterer.packages } }, { upsert: true });
  res.json({ success: true, packages: caterer.packages });
});

app.post('/caterer-package/edit', requireCaterer, upload.single('image'), async (req, res) => {
  const { index, name, category, price, inclusions } = req.body;
  const caterer = caterers.find(c => c.name === req.session.caterer.businessName);
  if (!caterer) return res.status(404).json({ error: 'Caterer not found' });
  const pkg = caterer.packages[parseInt(index)];
  if (!pkg) return res.status(404).json({ error: 'Package not found' });
  let variants = [];
  const variantNames = req.body.variantNames ? (Array.isArray(req.body.variantNames) ? req.body.variantNames : [req.body.variantNames]) : [];
  const variantPrices = req.body.variantPrices ? (Array.isArray(req.body.variantPrices) ? req.body.variantPrices : [req.body.variantPrices]) : [];
  variantNames.forEach((vname, i) => { if (vname.trim()) { variants.push({ name: vname.trim(), price: parseFloat(variantPrices[i]) || 0 }); } });
  pkg.name = name || pkg.name; pkg.category = category || pkg.category; pkg.inclusions = inclusions !== undefined ? inclusions : pkg.inclusions;
  pkg.variants = variants; pkg.price = variants.length > 0 ? 0 : (parseFloat(price) || pkg.price);
  if (req.file) {
    try { pkg.image = await uploadToCloudinary(req.file.buffer, req.file.mimetype, 'bunyi/packages'); } catch(e) { console.log('Image upload error:', e.message); }
  }
  await mdb.collection('caterers').updateOne({ name: caterer.name }, { $set: { packages: caterer.packages } }, { upsert: true });
  res.json({ success: true, packages: caterer.packages });
});

app.delete('/caterer-package', requireCaterer, async (req, res) => {
  const { index } = req.body;
  const caterer = caterers.find(c => c.name === req.session.caterer.businessName);
  if (!caterer) return res.status(404).json({ error: 'Caterer not found' });
  if (index !== undefined && caterer.packages[parseInt(index)]) { caterer.packages.splice(parseInt(index), 1); }
  await mdb.collection('caterers').updateOne({ name: caterer.name }, { $set: { packages: caterer.packages } }, { upsert: true });
  res.json({ success: true, packages: caterer.packages });
});

app.post('/caterer-qr', upload.array('qrImages', 5), async (req, res) => {
  if (!req.session.caterer) return res.status(401).json({ error: 'Not logged in' });
  const caterer = caterers.find(c => c.name === req.session.caterer.businessName);
  if (!caterer) return res.status(404).json({ error: 'Caterer not found' });
  if (!caterer.qrCodes) caterer.qrCodes = [];
  if (caterer.qrCodes.length + req.files.length > 5) return res.status(400).json({ error: 'Max 5 QR codes allowed' });
  for (let i = 0; i < req.files.length; i++) {
    const f = req.files[i];
    let url = null;
    try { url = await uploadToCloudinary(f.buffer, f.mimetype, 'bunyi/qrcodes'); } catch(e) { console.log('QR upload error:', e.message); }
    caterer.qrCodes.push({ url, label: req.body.labels ? (Array.isArray(req.body.labels) ? req.body.labels[i] : req.body.labels) || '' : '', recipient: req.body.recipients ? (Array.isArray(req.body.recipients) ? req.body.recipients[i] : req.body.recipients) || '' : '', account: req.body.accounts ? (Array.isArray(req.body.accounts) ? req.body.accounts[i] : req.body.accounts) || '' : '' });
  }
  await mdb.collection('caterers').updateOne({ name: caterer.name }, { $set: { qrCodes: caterer.qrCodes } }, { upsert: true });
  res.json({ success: true, qrCodes: caterer.qrCodes });
});

app.delete('/caterer-qr', (req, res) => {
  if (!req.session.caterer) return res.status(401).json({ error: 'Not logged in' });
  const caterer = caterers.find(c => c.name === req.session.caterer.businessName);
  if (!caterer) return res.status(404).json({ error: 'Caterer not found' });
  const { index } = req.body;
  if (index !== undefined && caterer.qrCodes[index]) { caterer.qrCodes.splice(index, 1); }
  res.json({ success: true, qrCodes: caterer.qrCodes });
});

app.get('/admin-login', (req, res) => res.sendFile(path.join(__dirname, 'admin-login.html')));
app.get('/admin-dashboard', (req, res) => res.sendFile(path.join(__dirname, 'admin-dashboard.html')));
app.get('/admin-users', (req, res) => res.json(users));
app.get('/admin-caterers', (req, res) => { const merged = caterers.map(c => { const cu = catererUsers.find(u => u.businessName === c.name); return { ...c, email: cu ? cu.email : '', contactNumber: cu ? cu.contactNumber : '', businessAddress: cu ? cu.businessAddress : '' }; }); res.json(merged); });
app.get('/admin-bookings', (req, res) => res.json(bookings));
app.post('/admin-delete-user', (req, res) => { const { index } = req.body; if (index !== undefined && users[index]) { users.splice(index, 1); } res.json({ success: true }); });
app.post('/admin-delete-caterer', (req, res) => { const { index } = req.body; if (index !== undefined && caterers[index]) { const name = caterers[index].name; caterers.splice(index, 1); const cuIdx = catererUsers.findIndex(u => u.businessName === name); if (cuIdx !== -1) catererUsers.splice(cuIdx, 1); mdb.collection('caterers').doc(name).delete().catch(() => {}); } res.json({ success: true }); });

app.post('/pay-remaining', upload.single('receipt'), async (req, res) => {
  const { bookingId, platform, reference } = req.body;
  const booking = bookings.find(b => b.bookingId === bookingId || b.id === bookingId);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  // Store the remaining amount before we mark it as fully paid
  const remaining2 = (parseFloat(booking.totalAmount) || 0) - (parseFloat(booking.amountPaid) || 0);
  booking.remaining2 = remaining2;
  booking.amountPaid = booking.totalAmount; booking.status = 'Fully Paid'; booking.verified = false;
  let receipt2Url = null;
  if (req.file) {
    try { receipt2Url = await uploadToCloudinary(req.file.buffer, req.file.mimetype, 'bunyi/receipts'); } catch(e) { console.log('Receipt upload error:', e.message); }
  }
  booking.receipt2 = receipt2Url;
  booking.platform2 = platform; booking.reference2 = reference;
  if (booking.id) {
    try {
      const { ObjectId } = require('mongodb');
      await mdb.collection('bookings').updateOne({ _id: new ObjectId(booking.id) }, { $set: { remaining2, amountPaid: booking.amountPaid, status: 'Fully Paid', verified: false, receipt2: receipt2Url, platform2: platform, reference2: reference } });
    } catch(e) {}
  }
  addNotification('booking', '✅ Your remaining balance for your event on ' + booking.date + ' has been submitted!');
  res.json({ success: true });
});

// ===== BLOCKED SLOTS =====
let blockedSlotsByBusiness = {};
let recurringDaysByBusiness = {}; // { 'BusinessName': [0,1] } — 0=Sun,1=Mon,...
let maxOrdersByBusiness = {}; // { 'BusinessName': 1 } — default 1 per slot

async function loadBlockedSlotsFromFirestore() {
  // Now handled in loadFromFirestore with MongoDB
  console.log('✅ Blocked slots loaded from MongoDB');
}

app.get('/caterer-blocked-slots', requireCaterer, (req, res) => {
  const bn = req.session.caterer.businessName;
  res.json({
    slots: blockedSlotsByBusiness[bn] || {},
    recurringDays: recurringDaysByBusiness[bn] || [],
    maxOrders: maxOrdersByBusiness[bn] || 1
  });
});

app.post('/caterer-blocked-slots', requireCaterer, async (req, res) => {
  const bn = req.session.caterer.businessName;
  const { slots, recurringDays, maxOrders } = req.body;
  if (slots) {
    if (!blockedSlotsByBusiness[bn]) blockedSlotsByBusiness[bn] = {};
    Object.entries(slots).forEach(([date, value]) => {
      if (value === null) { delete blockedSlotsByBusiness[bn][date]; }
      else { blockedSlotsByBusiness[bn][date] = value; }
    });
    try { await mdb.collection('blockedSlots').updateOne({ businessName: bn }, { $set: { slots: blockedSlotsByBusiness[bn] } }, { upsert: true }); } catch(e) {}
  }
  if (recurringDays !== undefined) {
    recurringDaysByBusiness[bn] = recurringDays;
    try { await mdb.collection('recurringDays').updateOne({ businessName: bn }, { $set: { days: recurringDays } }, { upsert: true }); } catch(e) {}
  }
  if (maxOrders !== undefined) {
    maxOrdersByBusiness[bn] = parseInt(maxOrders) || 1;
    try { await mdb.collection('maxOrders').updateOne({ businessName: bn }, { $set: { max: maxOrdersByBusiness[bn] } }, { upsert: true }); } catch(e) {}
  }
  res.json({ success: true, slots: blockedSlotsByBusiness[bn] || {}, recurringDays: recurringDaysByBusiness[bn] || [], maxOrders: maxOrdersByBusiness[bn] || 1 });
});

// Public endpoint for cart/book pages
app.get('/blocked-slots', (req, res) => {
  const { caterer } = req.query;
  if (!caterer) return res.json({ slots: {}, recurringDays: [], maxOrders: 1 });
  res.json({
    slots: blockedSlotsByBusiness[caterer] || {},
    recurringDays: recurringDaysByBusiness[caterer] || [],
    maxOrders: maxOrdersByBusiness[caterer] || 1
  });
});

// Updated booked-times: respects maxOrders
app.get('/booked-times', (req, res) => {
  const { caterer, date } = req.query;
  const max = maxOrdersByBusiness[caterer] || 1;
  // Count bookings per time slot for this caterer+date
  const timeCounts = {};
  bookings.filter(b => b.caterer === caterer && b.date === date).forEach(b => {
    timeCounts[b.time] = (timeCounts[b.time] || 0) + 1;
  });
  // Return times that have reached the max
  const fullyBooked = Object.entries(timeCounts).filter(([t, c]) => c >= max).map(([t]) => t);
  res.json(fullyBooked);
});

async function loadFromFirestore() {
  try {
    await connectMongo();
    console.log('Loading data from MongoDB...');
    users = await getCollection('users');
    catererUsers = await getCollection('catererUsers');
    const b = await getCollection('bookings');
    bookings = b.map(b => ({ ...b, id: b._id ? b._id.toString() : b.id, verified: b.verified || false, status: b.status || 'Pending Payment' }));
    const m = await getCollection('messages');
    messages = m.map(m => ({ ...m, id: m._id ? m._id.toString() : m.id }));
    const r = await getCollection('reviews');
    reviews = r.map(r => ({ ...r, id: r._id ? r._id.toString() : r.id }));
    const cn = await getCollection('catererNotifications');
    cn.forEach(d => { catererNotifications[d.businessName || d._id] = d.items || []; });
    const n = await getCollection('notifications');
    notifications = n.map(n => ({ ...n, id: n._id ? n._id.toString() : n.id }));
    const cats = await getCollection('caterers');
    if (cats.length > 0) {
      cats.forEach(fc => {
        const idx = caterers.findIndex(c => c.name === fc.name);
        if (idx !== -1) { caterers[idx] = { ...caterers[idx], ...fc, id: idx + 1 }; }
        else { caterers.push({ ...fc, id: caterers.length + 1 }); }
      });
    }
    const bs = await getCollection('blockedSlots');
    bs.forEach(d => { blockedSlotsByBusiness[d.businessName || d._id] = d.slots || {}; });
    const rd = await getCollection('recurringDays');
    rd.forEach(d => { recurringDaysByBusiness[d.businessName || d._id] = d.days || []; });
    const mo = await getCollection('maxOrders');
    mo.forEach(d => { maxOrdersByBusiness[d.businessName || d._id] = d.max || 1; });
    console.log('✅ Data loaded from MongoDB:', users.length, 'users,', bookings.length, 'bookings,', messages.length, 'messages');
  } catch(e) { console.log('⚠️ Could not load from MongoDB:', e.message); }
}

async function saveToFirestore(collection, data, id) {
  return await saveToMongo(collection, data, id);
}

async function startServer() {
  await loadFromFirestore();
  app.listen(process.env.PORT || 3000, () => { console.log('Server running on port ' + (process.env.PORT || 3000)); });
}
startServer();
