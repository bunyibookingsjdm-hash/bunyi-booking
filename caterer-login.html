<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <link rel="icon" type="image/png" href="/favicon.png">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Caterer Portal – Bunyi</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --orange: #E8450A; --orange-light: #fff0eb; --dark: #1A1A1A;
      --white: #ffffff; --bg: #f8f8f8; --border: #e8e8e8; --muted: #888; --text: #333;
    }
    body { font-family: 'Poppins', sans-serif; background: var(--bg); min-height: 100vh; display: flex; flex-direction: column; }
    .header { background: var(--dark); padding: 0 40px; height: 62px; display: flex; align-items: center; box-shadow: 0 2px 12px rgba(0,0,0,0.18); }
    .header-brand { font-size: 1.25rem; font-weight: 700; color: var(--white); text-decoration: none; }
    .header-brand span { color: var(--orange); }
    .auth-wrap { flex: 1; display: flex; align-items: center; justify-content: center; padding: 48px 16px; }
    .auth-box { background: var(--white); border: 1px solid var(--border); border-radius: 16px; padding: 36px; width: 100%; max-width: 480px; box-shadow: 0 4px 24px rgba(0,0,0,0.07); animation: fadeUp 0.4s ease forwards; }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
    .auth-icon { width: 48px; height: 48px; border-radius: 12px; background: var(--orange-light); display: flex; align-items: center; justify-content: center; font-size: 1.4rem; margin-bottom: 16px; }
    .auth-eyebrow { font-size: 0.7rem; font-weight: 600; color: var(--orange); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px; }
    .auth-title { font-size: 1.4rem; font-weight: 700; color: var(--dark); margin-bottom: 4px; }
    .auth-sub { font-size: 0.83rem; color: var(--muted); margin-bottom: 24px; }
    .section-label { font-size: 0.7rem; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em; margin: 20px 0 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border); }
    .form-group { margin-bottom: 14px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    label { display: block; font-size: 0.72rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 5px; }
    input, textarea { width: 100%; padding: 10px 13px; border: 1.5px solid var(--border); border-radius: 8px; font-family: 'Poppins', sans-serif; font-size: 0.9rem; color: var(--dark); background: var(--white); outline: none; transition: border-color 0.2s, box-shadow 0.2s; }
    input:focus, textarea:focus { border-color: var(--orange); box-shadow: 0 0 0 3px rgba(232,69,10,0.1); }
    textarea { resize: vertical; min-height: 76px; }
    .pw-wrap { position: relative; }
    .pw-wrap input { padding-right: 40px; }
    .pw-toggle { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; font-size: 1rem; color: var(--muted); padding: 0; line-height: 1; }
    .pw-toggle:hover { color: var(--orange); }
    .pw-strength { margin-top: 6px; }
    .pw-strength-bar { height: 4px; border-radius: 2px; background: var(--border); overflow: hidden; margin-bottom: 4px; }
    .pw-strength-fill { height: 100%; border-radius: 2px; transition: width 0.3s, background 0.3s; width: 0%; }
    .pw-strength-text { font-size: 0.68rem; font-weight: 600; }
    .pw-rules { font-size: 0.68rem; color: var(--muted); margin-top: 4px; line-height: 1.6; }
    .pw-rules span { display: block; }
    .pw-rules span.ok { color: #16a34a; }
    .pw-rules span.fail { color: #e53e3e; }
    .address-row { display: grid; grid-template-columns: 2fr 1fr; gap: 12px; }
    .error-msg { background: #fff0eb; border: 1px solid #ffd0bc; border-radius: 8px; padding: 10px 14px; font-size: 0.82rem; color: #c93a08; margin-bottom: 16px; display: none; align-items: center; gap: 8px; }
    .error-msg.show { display: flex; }
    .info-msg { background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 10px 14px; font-size: 0.82rem; color: #16a34a; margin-bottom: 16px; display: none; align-items: center; gap: 8px; }
    .info-msg.show { display: flex; }
    .btn-submit { width: 100%; padding: 13px; background: var(--orange); color: var(--white); border: none; border-radius: 8px; font-family: 'Poppins', sans-serif; font-size: 0.92rem; font-weight: 700; cursor: pointer; margin-top: 6px; transition: background 0.2s, transform 0.15s; }
    .btn-submit:hover { background: #c93a08; transform: translateY(-1px); }
    .btn-submit:disabled { background: #ccc; cursor: not-allowed; transform: none; }
    .divider { height: 1px; background: var(--border); margin: 24px 0; }
    .switch-hint { text-align: center; font-size: 0.82rem; color: var(--muted); }
    .switch-hint a { color: var(--orange); font-weight: 600; text-decoration: none; cursor: pointer; }
    .switch-hint a:hover { text-decoration: underline; }
    .form-panel { display: none; }
    .form-panel.active { display: block; }
    .success-panel { text-align: center; padding: 10px 0; }
    .success-panel .big-icon { font-size: 3rem; margin-bottom: 16px; }
    .success-panel h2 { font-size: 1.2rem; font-weight: 700; color: var(--dark); margin-bottom: 10px; }
    .success-panel p { font-size: 0.86rem; color: var(--muted); line-height: 1.6; margin-bottom: 20px; }
    .resend-link { font-size: 0.8rem; color: var(--muted); margin-top: 12px; }
    .resend-link a { color: var(--orange); font-weight: 600; cursor: pointer; text-decoration: none; }
    .resend-link a:hover { text-decoration: underline; }
    @media (max-width: 520px) { .auth-box { padding: 28px 20px; } .form-row { grid-template-columns: 1fr; } .address-row { grid-template-columns: 1fr; } .header { padding: 0 20px; } }
  </style>
</head>
<body>
  <header class="header">
    <a href="/" class="header-brand">Bunyi<span>.</span></a>
  </header>

  <div class="auth-wrap">
    <div class="auth-box">

      <!-- LOGIN PANEL -->
      <div class="form-panel active" id="panelLogin">
        <div class="auth-icon">👨‍🍳</div>
        <p class="auth-eyebrow">Caterer Portal</p>
        <h1 class="auth-title">Welcome back!</h1>
        <p class="auth-sub">Sign in to manage your catering business.</p>

        <div class="error-msg" id="loginError">
          ⚠️ <span id="loginErrorText">Invalid email or password.</span>
        </div>
        <div class="info-msg" id="loginInfo">
          <span id="loginInfoText"></span>
        </div>

        <form action="/caterer-login" method="POST">
          <div class="form-group">
            <label>Email Address</label>
            <input type="email" name="email" placeholder="you@example.com" required autocomplete="email">
          </div>
          <div class="form-group">
            <label>Password</label>
            <div class="pw-wrap">
              <input type="password" name="password" id="login-password" placeholder="••••••••" required autocomplete="current-password">
              <button type="button" class="pw-toggle" onclick="togglePw('login-password', this)">👁️</button>
            </div>
          </div>
          <button type="submit" class="btn-submit">Sign In →</button>
        </form>

        <div class="divider"></div>
        <div class="switch-hint">
          Don't have an account? <a onclick="switchTo('register')">Create one here</a>
        </div>
      </div>

      <!-- REGISTER PANEL -->
      <div class="form-panel" id="panelRegister">
        <div class="auth-icon">👨‍🍳</div>
        <p class="auth-eyebrow">Caterer Portal</p>
        <h1 class="auth-title">Create Account</h1>
        <p class="auth-sub">Join Bunyi and start receiving bookings from customers.</p>

        <div class="error-msg" id="registerError">
          ⚠️ <span id="registerErrorText"></span>
        </div>

        <form id="catererRegisterForm" autocomplete="off">
          <p class="section-label">Account Info</p>
          <div class="form-group">
            <label>Email Address *</label>
            <input type="email" id="reg-email" placeholder="you@example.com" required autocomplete="off">
          </div>
          <div class="form-group">
            <label>Password *</label>
            <div class="pw-wrap">
              <input type="password" id="reg-password" placeholder="Min. 8 characters" required autocomplete="new-password" oninput="checkPasswordStrength(this.value)">
              <button type="button" class="pw-toggle" onclick="togglePw('reg-password', this)">👁️</button>
            </div>
            <div class="pw-strength" id="pwStrength" style="display:none;">
              <div class="pw-strength-bar"><div class="pw-strength-fill" id="pwFill"></div></div>
              <div class="pw-strength-text" id="pwText"></div>
              <div class="pw-rules">
                <span id="rule-len">✗ At least 8 characters</span>
                <span id="rule-upper">✗ At least 1 uppercase letter</span>
                <span id="rule-num">✗ At least 1 number</span>
                <span id="rule-special">✗ At least 1 special character (!@#$%)</span>
              </div>
            </div>
          </div>
          <div class="form-group">
            <label>Confirm Password *</label>
            <div class="pw-wrap">
              <input type="password" id="reg-confirm" placeholder="Repeat password" required autocomplete="new-password">
              <button type="button" class="pw-toggle" onclick="togglePw('reg-confirm', this)">👁️</button>
            </div>
          </div>

          <p class="section-label">Business Info</p>
          <div class="form-group">
            <label>Name of Business *</label>
            <input type="text" id="reg-businessName" placeholder="e.g. Bulacan Feast Catering" required>
          </div>

          <!-- Street + City/Province -->
          <div class="form-group">
            <label>Street / Barangay *</label>
            <input type="text" id="reg-street" placeholder="e.g. 123 Rizal St., Brgy. San Jose" required>
          </div>
          <div class="address-row">
            <div class="form-group">
              <label>City / Municipality *</label>
              <input type="text" id="reg-city" placeholder="e.g. San Jose del Monte" required>
            </div>
            <div class="form-group">
              <label>Province *</label>
              <input type="text" id="reg-province" placeholder="e.g. Bulacan" required>
            </div>
          </div>

          <div class="form-group">
            <label>Contact Number *</label>
            <input type="tel" id="reg-contactNumber" placeholder="e.g. 09XX XXX XXXX" required>
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea id="reg-description" placeholder="Tell customers about your catering service..."></textarea>
          </div>

          <button type="submit" class="btn-submit" id="catererRegisterBtn">Create Account →</button>
        </form>

        <div class="divider"></div>
        <div class="switch-hint">
          Already have an account? <a onclick="switchTo('login')">Sign in here</a>
        </div>
      </div>

      <!-- SUCCESS PANEL -->
      <div class="form-panel" id="panelSuccess">
        <div class="success-panel">
          <div class="big-icon">📧</div>
          <h2>Check your email!</h2>
          <p>We sent a verification link to<br><strong id="sentToEmail"></strong>.<br><br>Click the link in your inbox to verify your account, then come back to log in.</p>
          <button class="btn-submit" onclick="switchTo('login')">Go to Login →</button>
          <div class="resend-link">
            Didn't receive it? <a id="resendLink" onclick="resendVerification()">Resend email</a>
          </div>
        </div>
      </div>

    </div>
  </div>

  <!-- Firebase SDK -->
  <script type="module">
    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
    import { getAuth, createUserWithEmailAndPassword, sendEmailVerification }
      from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

    const firebaseConfig = {
      apiKey: "AIzaSyCCUqmHtG4_0Ilf4FcBqxEK1BIYghp8p2k",
      authDomain: "bunyi-booking.firebaseapp.com",
      projectId: "bunyi-booking",
      storageBucket: "bunyi-booking.firebasestorage.app",
      messagingSenderId: "804848365019",
      appId: "1:804848365019:web:22fc0265ef2d0baf6dcbfe"
    };

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    window._lastCatererUser = null;

    document.getElementById('catererRegisterForm').addEventListener('submit', async function(e) {
      e.preventDefault();

      const email          = document.getElementById('reg-email').value.trim();
      const password       = document.getElementById('reg-password').value;
      const confirm        = document.getElementById('reg-confirm').value;
      const businessName   = document.getElementById('reg-businessName').value.trim();
      const street         = document.getElementById('reg-street').value.trim();
      const city           = document.getElementById('reg-city').value.trim();
      const province       = document.getElementById('reg-province').value.trim();
      const contactNumber  = document.getElementById('reg-contactNumber').value.trim();
      const description    = document.getElementById('reg-description').value.trim();

      const businessAddress = `${street}, ${city}, ${province}`;

      document.getElementById('registerError').classList.remove('show');

      // Validations
      if (!email) return showRegErr('Please enter your email address.');
      if (password.length < 8) return showRegErr('Password must be at least 8 characters.');
      if (!/[A-Z]/.test(password)) return showRegErr('Password must contain at least 1 uppercase letter.');
      if (!/[0-9]/.test(password)) return showRegErr('Password must contain at least 1 number.');
      if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return showRegErr('Password must contain at least 1 special character.');
      if (password !== confirm) return showRegErr('Passwords do not match.');
      if (!businessName) return showRegErr('Please enter your business name.');
      if (!street) return showRegErr('Please enter your street/barangay.');
      if (!city) return showRegErr('Please enter your city/municipality.');
      if (!province) return showRegErr('Please enter your province.');
      if (!contactNumber) return showRegErr('Please enter your contact number.');
      if (!/^(09|\+639)\d{9}$/.test(contactNumber.replace(/\s/g, ''))) return showRegErr('Please enter a valid Philippine mobile number (09XXXXXXXXX).');

      const btn = document.getElementById('catererRegisterBtn');
      btn.disabled = true;
      btn.textContent = 'Creating account...';

      try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(cred.user);
        await fetch('/caterer-register-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, businessName, businessAddress, contactNumber, description })
        });
        window._lastCatererUser = cred.user;
        document.getElementById('sentToEmail').textContent = email;
        switchTo('success');
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Create Account →';
        if (err.code === 'auth/email-already-in-use') return showRegErr('An account with this email already exists.');
        if (err.code === 'auth/invalid-email') return showRegErr('Please enter a valid email address.');
        if (err.code === 'auth/weak-password') return showRegErr('Password must be at least 8 characters.');
        showRegErr('Something went wrong. Please try again.');
        console.error(err);
      }
    });

    window.resendVerification = async function() {
      if (!window._lastCatererUser) return;
      try {
        await sendEmailVerification(window._lastCatererUser);
        document.getElementById('resendLink').textContent = 'Sent! Check your inbox.';
        document.getElementById('resendLink').style.cursor = 'default';
      } catch(e) {
        alert('Could not resend. Please try again in a minute.');
      }
    };

    function showRegErr(msg) {
      document.getElementById('registerError').classList.add('show');
      document.getElementById('registerErrorText').textContent = msg;
    }
  </script>

  <script>
    function togglePw(inputId, btn) {
      const input = document.getElementById(inputId);
      if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
      } else {
        input.type = 'password';
        btn.textContent = '👁️';
      }
    }

    function checkPasswordStrength(pw) {
      const strengthDiv = document.getElementById('pwStrength');
      const fill = document.getElementById('pwFill');
      const text = document.getElementById('pwText');
      strengthDiv.style.display = pw.length > 0 ? 'block' : 'none';

      const hasLen     = pw.length >= 8;
      const hasUpper   = /[A-Z]/.test(pw);
      const hasNum     = /[0-9]/.test(pw);
      const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw);

      document.getElementById('rule-len').textContent     = (hasLen     ? '✓' : '✗') + ' At least 8 characters';
      document.getElementById('rule-upper').textContent   = (hasUpper   ? '✓' : '✗') + ' At least 1 uppercase letter';
      document.getElementById('rule-num').textContent     = (hasNum     ? '✓' : '✗') + ' At least 1 number';
      document.getElementById('rule-special').textContent = (hasSpecial ? '✓' : '✗') + ' At least 1 special character (!@#$%)';

      document.getElementById('rule-len').className     = hasLen     ? 'ok' : 'fail';
      document.getElementById('rule-upper').className   = hasUpper   ? 'ok' : 'fail';
      document.getElementById('rule-num').className     = hasNum     ? 'ok' : 'fail';
      document.getElementById('rule-special').className = hasSpecial ? 'ok' : 'fail';

      const score = [hasLen, hasUpper, hasNum, hasSpecial].filter(Boolean).length;
      const colors = ['#e53e3e', '#e53e3e', '#f59e0b', '#16a34a'];
      const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
      fill.style.width = (score * 25) + '%';
      fill.style.background = colors[score - 1] || '#e8e8e8';
      text.textContent = labels[score] || '';
      text.style.color = colors[score - 1] || '#888';
    }

    function switchTo(panel) {
      document.getElementById('panelLogin').classList.toggle('active', panel === 'login');
      document.getElementById('panelRegister').classList.toggle('active', panel === 'register');
      document.getElementById('panelSuccess').classList.toggle('active', panel === 'success');
      if (panel === 'register') {
        document.getElementById('catererRegisterForm').reset();
        document.getElementById('registerError').classList.remove('show');
        document.getElementById('pwStrength').style.display = 'none';
      }
      document.querySelector('.auth-box').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    const params = new URLSearchParams(window.location.search);
    const loginErr = params.get('loginerror');
    if (loginErr === '1') {
      switchTo('login');
      document.getElementById('loginError').classList.add('show');
      document.getElementById('loginErrorText').textContent = 'Invalid email or password. Please try again.';
    }
    if (params.get('notverified') === '1') {
      switchTo('login');
      document.getElementById('loginError').classList.add('show');
      document.getElementById('loginErrorText').textContent = '⚠️ Please verify your email first. Check your inbox for the verification link.';
    }
  </script>
  <script src='https://cdn.jotfor.ms/agent/embedjs/019e466996117451b02c25c833a184e8bfc4/embed.js'></script>
</body>
</html>