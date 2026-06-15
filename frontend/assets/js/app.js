/* ============================================================
   COFINANCE CI — Application JavaScript
   Compatible Django /app/ ET ouverture directe des fichiers
   ============================================================ */

'use strict';

/* ─── CONFIGURATION API ─────────────────────────────────── */
// Si la page est servie par Django (port 8000) → URL relative (même origine)
// Sinon (file://, Live Server, autre port) → URL absolue vers Django
const API_BASE = (() => {
  const loc = window.location;
  const onDjango = (loc.protocol === 'http:' || loc.protocol === 'https:') &&
                   (loc.hostname === '127.0.0.1' || loc.hostname === 'localhost') &&
                   loc.port === '8000';
  return onDjango ? '' : 'http://127.0.0.1:8000';
})();

// URL de redirection adaptée au contexte (Django /app/ ou fichier direct)
const APP_ROOT = (() => {
  if (window.location.pathname.startsWith('/app/')) return '/app/';
  const parts = window.location.pathname.split('/');
  parts.pop(); // retirer le fichier courant
  return parts.join('/') + '/';
})();

// Helper : affecte textContent à un élément sans lever d'erreur si absent.
const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = String(val ?? ''); };

// Toggle visibilité mot de passe (eye icon)
function togglePwd(btn) {
  const wrapper = btn.closest('.input-with-toggle');
  const inp = wrapper.querySelector('input');
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  wrapper.querySelector('.eye-on').style.display  = show ? '' : 'none';
  wrapper.querySelector('.eye-off').style.display = show ? 'none' : '';
}
window.togglePwd = togglePwd;

const API = {
  // Auth
  login:         `${API_BASE}/api/auth/login/`,
  register:      `${API_BASE}/api/auth/register/`,
  tokenRefresh:  `${API_BASE}/api/auth/token/refresh/`,
  profile:       `${API_BASE}/api/auth/profile/`,
  // Credits
  credits:       `${API_BASE}/api/credits/`,
  creditStatus:  (id) => `${API_BASE}/api/credits/${id}/status/`,
  creditSchedule:(id) => `${API_BASE}/api/credits/${id}/schedule/`,
  // Repayments
  repayPay:      `${API_BASE}/api/repayments/pay/`,
  repayHistory:  (id) => `${API_BASE}/api/repayments/history/${id}/`,
  repayOverdue:  `${API_BASE}/api/repayments/overdue/`,
  // Insurance
  insuranceProducts:      `${API_BASE}/api/insurance/products/`,
  insuranceProductManage: `${API_BASE}/api/insurance/products/manage/`,
  insuranceProductDetail: (id) => `${API_BASE}/api/insurance/products/${id}/`,
  insuranceSubscribe:     `${API_BASE}/api/insurance/subscribe/`,
  insurancePolicies:      `${API_BASE}/api/insurance/policies/`,
  insuranceAll:           `${API_BASE}/api/insurance/policies/all/`,
  insuranceResilier:      (id) => `${API_BASE}/api/insurance/policies/${id}/resilier/`,
  agents:            `${API_BASE}/api/auth/agents/`,
  clients:           `${API_BASE}/api/auth/clients/`,
  agentManage:       `${API_BASE}/api/auth/admin/agents/`,
  agentDetail:       id => `${API_BASE}/api/auth/admin/agents/${id}/`,
  clientDetail:      id => `${API_BASE}/api/auth/admin/clients/${id}/`,
  // Dashboard
  dashStats:     `${API_BASE}/api/dashboard/stats/`,
  // Notifications
  notifications:      `${API_BASE}/api/notifications/`,
  notifRead:     (id) => `${API_BASE}/api/notifications/${id}/read/`,
  notifReadAll:  `${API_BASE}/api/notifications/read-all/`,
  notifCount:    `${API_BASE}/api/notifications/unread-count/`,
  // Chat
  conversations:      `${API_BASE}/api/chat/conversations/`,
  chatMessages:  (id) => `${API_BASE}/api/chat/conversations/${id}/messages/`,
  chatAssign:    (id) => `${API_BASE}/api/chat/conversations/${id}/assign/`,
  chatClose:     (id) => `${API_BASE}/api/chat/conversations/${id}/close/`,
  // WebSocket — adapté à l'hôte courant
  wsChat:        (id) => {
    const host = window.location.port === '8000'
      ? window.location.host
      : '127.0.0.1:8000';
    return `ws://${host}/ws/chat/${id}/`;
  },
};

/* ─── AUTH MANAGER ──────────────────────────────────────── */
const Auth = {
  getToken()    { return sessionStorage.getItem('access_token'); },
  getRefresh()  { return sessionStorage.getItem('refresh_token'); },
  getUser()     { const u = sessionStorage.getItem('user'); return u ? JSON.parse(u) : null; },
  isLoggedIn()  { return !!this.getToken(); },

  save(tokens, user) {
    sessionStorage.setItem('access_token',  tokens.access);
    sessionStorage.setItem('refresh_token', tokens.refresh);
    sessionStorage.setItem('user', JSON.stringify(user));
  },

  clear() {
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('refresh_token');
    sessionStorage.removeItem('user');
  },

  logout() {
    this.clear();
    window.location.href = APP_ROOT + 'login.html';
  },

  async refresh() {
    const refresh = this.getRefresh();
    if (!refresh) return false;
    try {
      const res = await fetch(API.tokenRefresh, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      });
      if (!res.ok) { this.logout(); return false; }
      const data = await res.json();
      sessionStorage.setItem('access_token', data.access);
      if (data.refresh) sessionStorage.setItem('refresh_token', data.refresh);
      return true;
    } catch { return false; }
  },

  requireLogin(role = null) {
    if (!this.isLoggedIn()) {
      window.location.href = APP_ROOT + 'login.html';
      return false;
    }
    if (role) {
      const user = this.getUser();
      const allowed = Array.isArray(role) ? role : [role];
      if (!allowed.includes(user?.role)) {
        Toast.show('Accès non autorisé', 'error', 'Vous n\'avez pas les droits nécessaires.');
        setTimeout(() => window.history.back(), 1500);
        return false;
      }
    }
    return true;
  },
};

/* ─── HTTP CLIENT ───────────────────────────────────────── */
const Http = {
  async request(url, options = {}) {
    const token = Auth.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };

    try {
      let res = await fetch(url, { ...options, headers });

      // Auto-refresh on 401
      if (res.status === 401) {
        const refreshed = await Auth.refresh();
        if (refreshed) {
          headers['Authorization'] = `Bearer ${Auth.getToken()}`;
          res = await fetch(url, { ...options, headers });
        } else {
          Auth.logout();
          return null;
        }
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        // Extract DRF validation errors ({"field": ["msg"]} or {"detail": "msg"})
        let msg = typeof err.detail === 'string' ? err.detail : null;
        if (!msg) {
          const firstKey = Object.keys(err)[0];
          if (firstKey) {
            const val = err[firstKey];
            msg = Array.isArray(val) ? val[0] : (typeof val === 'string' ? val : null);
          }
        }
        throw new Error(msg || `Erreur ${res.status}`);
      }

      const ct = res.headers.get('content-type');
      if (ct && ct.includes('application/json')) return await res.json();
      return null;
    } catch (e) {
      throw e;
    }
  },

  get(url, params = {})  {
    const q = new URLSearchParams(params).toString();
    return this.request(q ? `${url}?${q}` : url);
  },
  post(url, data)   { return this.request(url, { method: 'POST',  body: JSON.stringify(data) }); },
  patch(url, data)  { return this.request(url, { method: 'PATCH', body: JSON.stringify(data) }); },
  put(url, data)    { return this.request(url, { method: 'PUT',   body: JSON.stringify(data) }); },
  delete(url)       { return this.request(url, { method: 'DELETE' }); },

  async postForm(url, formData) {
    const token = Auth.getToken();
    const res = await fetch(url, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(JSON.stringify(err));
    }
    return res.json();
  },
};

/* ─── TOAST ──────────────────────────────────────────────── */
const Toast = {
  container: null,

  init() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
  },

  show(title, type = 'info', message = '', duration = 4000) {
    this.init();
    const icons = {
      success: '✓',
      error:   '✕',
      warning: '⚠',
      info:    'ℹ',
    };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <div class="toast-icon">${icons[type] || icons.info}</div>
      <div class="flex-1">
        <div class="toast-title">${title}</div>
        ${message ? `<div class="toast-message">${message}</div>` : ''}
      </div>
      <button class="toast-close" onclick="this.closest('.toast').remove()">×</button>
    `;
    this.container.appendChild(toast);
    setTimeout(() => toast.style.opacity = '0', duration - 400);
    setTimeout(() => toast.remove(), duration);
    return toast;
  },
};

/* ─── MODAL ──────────────────────────────────────────────── */
const Modal = {
  open(id)  {
    const el = document.getElementById(id);
    if (el) { el.classList.add('active'); document.body.style.overflow = 'hidden'; }
  },
  close(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('active'); document.body.style.overflow = ''; }
  },
  closeAll() {
    document.querySelectorAll('.modal-overlay.active').forEach(el => {
      el.classList.remove('active');
    });
    document.body.style.overflow = '';
  },
};

/* ─── LOADER ─────────────────────────────────────────────── */
const Loader = {
  show() {
    let el = document.getElementById('globalLoader');
    if (!el) {
      el = document.createElement('div');
      el.id = 'globalLoader';
      el.className = 'loader-overlay';
      el.innerHTML = `
        <div class="spinner"></div>
        <p style="font-size:.875rem;color:var(--text-secondary)">Chargement...</p>
      `;
      document.body.appendChild(el);
    }
    el.style.display = 'flex';
  },
  hide() {
    const el = document.getElementById('globalLoader');
    if (el) el.style.display = 'none';
  },
};

/* ─── SIDEBAR ────────────────────────────────────────────── */
const Sidebar = {
  init() {
    const toggle  = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    if (toggle && sidebar) {
      toggle.addEventListener('click', () => this.toggle());
    }
    if (overlay) {
      overlay.addEventListener('click', () => this.close());
    }

    // Mark active nav item
    const path = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-item').forEach(item => {
      const href = item.getAttribute('href');
      if (href && href.includes(path)) item.classList.add('active');
    });

    // Fill user info
    this.fillUser();

    // Unread count badge
    this.loadUnreadCount();
  },

  open() {
    document.getElementById('sidebar')?.classList.add('open');
    document.getElementById('sidebarOverlay')?.classList.add('active');
  },
  close() {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebarOverlay')?.classList.remove('active');
  },
  toggle() {
    const sb = document.getElementById('sidebar');
    sb?.classList.contains('open') ? this.close() : this.open();
  },

  fillUser() {
    const user = Auth.getUser();
    if (!user) return;
    const name  = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
    const role  = { CLIENT: 'Client', AGENT: 'Agent', ADMIN: 'Administrateur' }[user.role] || user.role;
    const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);

    document.querySelectorAll('.sidebar-user-name').forEach(el => el.textContent = name);
    document.querySelectorAll('.sidebar-user-role').forEach(el => el.textContent = role);
    document.querySelectorAll('.sidebar-avatar').forEach(el => el.textContent = initials);
    document.querySelectorAll('.topbar-user-name').forEach(el => el.textContent = name);
    document.querySelectorAll('.topbar-avatar').forEach(el => el.textContent = initials);

    // Adapter la sidebar pour les agents sur les pages partagées admin/agent
    if (user.role === 'AGENT') {
      document.querySelectorAll('.sidebar-brand-tag').forEach(el => el.textContent = 'ESPACE AGENT');
      document.querySelectorAll('.sidebar-avatar').forEach(el => {
        el.style.background = 'linear-gradient(135deg,#0ea5e9,#38bdf8)';
      });
      const nav = document.querySelector('.sidebar-nav');
      if (nav && nav.querySelector('a[href="admin-dashboard.html"]')) {
        nav.innerHTML = `
          <div class="nav-section-label">Mon espace</div>
          <a href="agent-dashboard.html" class="nav-item">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            Tableau de bord
          </a>
          <a href="admin-credits.html" class="nav-item">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            Mes crédits
          </a>
          <a href="admin-support.html" class="nav-item">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            Support client
          </a>
        `;
        const path = window.location.pathname.split('/').pop() || '';
        nav.querySelectorAll('.nav-item').forEach(item => {
          const href = item.getAttribute('href');
          if (href && path && href.includes(path)) item.classList.add('active');
        });
      }
      document.querySelectorAll('.breadcrumb-link[href="admin-dashboard.html"]').forEach(el => {
        el.href = 'agent-dashboard.html';
        el.textContent = 'Tableau de bord';
      });
    }
  },

  async loadUnreadCount() {
    try {
      const data = await Http.get(API.notifCount);
      if (data && data.count > 0) {
        document.querySelectorAll('.notif-count-badge').forEach(el => {
          el.textContent = data.count;
          el.style.display = 'flex';
        });
      }
    } catch {}
  },
};

/* ─── DROPDOWN ────────────────────────────────────────────── */
const Dropdown = {
  init() {
    document.addEventListener('click', (e) => {
      const trigger = e.target.closest('[data-dropdown]');
      if (trigger) {
        const targetId = trigger.dataset.dropdown;
        const menu = document.getElementById(targetId);
        if (menu) {
          document.querySelectorAll('.dropdown-menu.active').forEach(m => {
            if (m !== menu) m.classList.remove('active');
          });
          menu.classList.toggle('active');
          e.stopPropagation();
        }
      } else {
        document.querySelectorAll('.dropdown-menu.active').forEach(m => m.classList.remove('active'));
      }
    });
  },
};

/* ─── TABS ────────────────────────────────────────────────── */
const Tabs = {
  init() {
    document.querySelectorAll('[data-tab-target]').forEach(btn => {
      btn.addEventListener('click', () => {
        const group = btn.closest('[data-tabs]') || btn.parentElement;
        const targetId = btn.dataset.tabTarget;
        // Deactivate siblings
        group.querySelectorAll('[data-tab-target]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        // Show target panel
        const container = btn.closest('.tab-container') || document;
        container.querySelectorAll('[data-tab-panel]').forEach(panel => {
          panel.style.display = panel.id === targetId ? '' : 'none';
        });
      });
    });
  },
};

/* ─── FORMAT UTILITIES ───────────────────────────────────── */
const Fmt = {
  money(n) {
    if (n === null || n === undefined) return '—';
    return new Intl.NumberFormat('fr-CI', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(n);
  },
  date(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-CI', { day:'2-digit', month:'short', year:'numeric' });
  },
  datetime(d) {
    if (!d) return '—';
    return new Date(d).toLocaleString('fr-CI', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
  },
  relativeTime(d) {
    if (!d) return '';
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    const hrs  = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    if (mins < 1)   return 'À l\'instant';
    if (mins < 60)  return `Il y a ${mins} min`;
    if (hrs  < 24)  return `Il y a ${hrs} h`;
    if (days === 1) return 'Hier';
    return this.date(d);
  },
  initials(name) {
    if (!name) return '??';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  },
  statusBadge(status) {
    const map = {
      SOUMISE:    { label: 'Soumise',    cls: 'badge-warning' },
      EN_ANALYSE: { label: 'En analyse', cls: 'badge-info' },
      APPROUVEE:  { label: 'Approuvée',  cls: 'badge-primary' },
      DECAISSEE:  { label: 'Décaissée',  cls: 'badge-success' },
      REJETEE:    { label: 'Rejetée',    cls: 'badge-danger' },
      EN_ATTENTE: { label: 'En attente', cls: 'badge-warning' },
      PAYEE:      { label: 'Payée',      cls: 'badge-success' },
      EN_RETARD:  { label: 'En retard',  cls: 'badge-danger' },
      ACTIVE:     { label: 'Active',     cls: 'badge-success' },
      EXPIREE:    { label: 'Expirée',    cls: 'badge-muted' },
      RESILIEE:   { label: 'Résiliée',   cls: 'badge-danger' },
      OUVERTE:    { label: 'Ouverte',    cls: 'badge-primary' },
      EN_COURS:   { label: 'En cours',   cls: 'badge-warning' },
      FERMEE:     { label: 'Fermée',     cls: 'badge-muted' },
    };
    const s = map[status] || { label: status, cls: 'badge-muted' };
    return `<span class="badge ${s.cls}">${s.label}</span>`;
  },
};


/* ─── PAGE-SPECIFIC MODULES ─────────────────────────────── */

/* LOGIN */
const LoginPage = {
  async init() {
    const form = document.getElementById('loginForm');
    if (!form) return;

    // Zone d'erreur inline
    let errBox = document.getElementById('loginError');
    if (!errBox) {
      errBox = document.createElement('div');
      errBox.id = 'loginError';
      errBox.style.cssText = 'display:none;background:#FEE2E2;color:#B91C1C;border:1px solid #FCA5A5;border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:.875rem;font-weight:500';
      form.prepend(errBox);
    }
    const showErr = (msg) => { errBox.textContent = msg; errBox.style.display = 'block'; errBox.scrollIntoView({ behavior:'smooth', block:'nearest' }); };
    const hideErr = () => { errBox.style.display = 'none'; };

    // Soumission du formulaire
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideErr();

      const btn      = form.querySelector('[type="submit"]');
      const email    = form.querySelector('[name="email"]').value.trim();
      const password = form.querySelector('[name="password"]').value;

      if (!email || !password) { showErr('Veuillez saisir votre email et votre mot de passe.'); return; }

      const originalHTML = btn.innerHTML;
      btn.disabled  = true;
      btn.innerHTML = '<span style="display:inline-block;width:16px;height:16px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin .7s linear infinite;vertical-align:middle;margin-right:8px"></span> Connexion...';

      try {
        const data = await Http.post(API.login, { email, password });
        if (!data?.tokens || !data?.user) throw new Error('Réponse inattendue du serveur.');

        Auth.save(data.tokens, data.user);
        btn.innerHTML = '✓ Connecté !';
        btn.style.background = '#22C55E';

        const dest = (data.user.role === 'CLIENT') ? 'client-dashboard.html' : 'admin-dashboard.html';
        window.location.href = APP_ROOT + dest;

      } catch (err) {
        let msg = err.message || 'Erreur de connexion.';
        if (msg.toLowerCase().includes('fetch') || msg.includes('Failed'))
          msg = 'Impossible de joindre le serveur. Vérifiez que Django tourne sur http://127.0.0.1:8000';
        showErr(msg);
        btn.disabled  = false;
        btn.innerHTML = originalHTML;
        btn.style.background = '';
      }
    });

    // Boutons connexion rapide — remplissent ET soumettent
    document.querySelectorAll('[data-quick-login]').forEach(btn => {
      btn.addEventListener('click', () => {
        const [email, password] = btn.dataset.quickLogin.split(':');
        form.querySelector('[name="email"]').value    = email;
        form.querySelector('[name="password"]').value = password;
        hideErr();
        form.requestSubmit();
      });
    });

    // ── Si déjà connecté : bandeau + masquer le formulaire complet ──────────
    if (Auth.isLoggedIn()) {
      const user = Auth.getUser();
      const dest = (user?.role === 'CLIENT') ? 'client-dashboard.html' : 'admin-dashboard.html';
      const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email || 'vous';

      const banner = document.createElement('div');
      banner.style.cssText = 'background:#EFF6FF;border:1px solid #BFDBFE;border-radius:10px;padding:20px;text-align:center';
      banner.innerHTML = `
        <div style="font-size:1rem;font-weight:600;color:#1D4ED8;margin-bottom:14px">
          ✓ Connecté en tant que <strong>${fullName}</strong>
        </div>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          <button id="btnContinue" style="padding:8px 18px;background:#1D4ED8;color:#fff;border:none;border-radius:8px;font-size:.9rem;font-weight:600;cursor:pointer">
            Aller à mon espace →
          </button>
          <button id="btnSwitch" style="padding:8px 18px;background:transparent;color:#1D4ED8;border:1px solid #BFDBFE;border-radius:8px;font-size:.9rem;font-weight:500;cursor:pointer">
            Changer de compte
          </button>
        </div>`;

      // Remplacer le contenu du wrapper par le bandeau seulement
      const wrapper = document.querySelector('.auth-form-wrapper');
      if (wrapper) {
        wrapper.innerHTML = '';
        const header = document.createElement('div');
        header.innerHTML = '<h1 style="font-size:1.6rem;font-weight:700;margin-bottom:6px">Se connecter</h1><p style="color:#64748B;margin-bottom:24px">Accédez à votre espace personnel COFINANCE CI</p>';
        wrapper.appendChild(header);
        wrapper.appendChild(banner);
      } else {
        form.style.display = 'none';
        form.parentNode.insertBefore(banner, form);
      }

      document.getElementById('btnContinue').onclick = () => { window.location.href = APP_ROOT + dest; };
      document.getElementById('btnSwitch').onclick   = () => { Auth.clear(); window.location.reload(); };
    }
  },
};

/* REGISTER */
const RegisterPage = {
  async init() {
    const form = document.getElementById('registerForm');
    if (!form) return;

    // Boîte d'erreur inline
    let errBox = document.getElementById('registerError');
    if (!errBox) {
      errBox = document.createElement('div');
      errBox.id = 'registerError';
      errBox.style.cssText = 'display:none;background:#FEE2E2;color:#B91C1C;border:1px solid #FCA5A5;border-radius:8px;padding:12px 16px;margin-bottom:16px;font-size:.875rem;font-weight:500';
      form.prepend(errBox);
    }
    const showErr = (msg) => { errBox.textContent = msg; errBox.style.display = 'block'; errBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); };
    const hideErr = () => { errBox.style.display = 'none'; };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideErr();
      const btn = form.querySelector('[type="submit"]');

      const rawPhone = form.querySelector('[name="phone"]').value.trim();
      // Ajouter le préfixe +225 si absent
      const phone = rawPhone
        ? (rawPhone.startsWith('+') ? rawPhone : '+225' + rawPhone.replace(/\s/g, ''))
        : '';

      const data = {
        email:            form.querySelector('[name="email"]').value.trim(),
        first_name:       form.querySelector('[name="first_name"]').value.trim(),
        last_name:        form.querySelector('[name="last_name"]').value.trim(),
        phone,
        password:         form.querySelector('[name="password"]').value,
        password_confirm: form.querySelector('[name="password_confirm"]').value,
      };
      const dob = form.querySelector('[name="date_naissance"]')?.value;
      if (dob) data.date_naissance = dob;

      if (!data.email || !data.first_name || !data.last_name) {
        showErr('Veuillez remplir tous les champs obligatoires.');
        return;
      }
      if (data.password !== data.password_confirm) {
        showErr('Les mots de passe ne correspondent pas.');
        return;
      }

      const originalHTML = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span style="display:inline-block;width:16px;height:16px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin .7s linear infinite;vertical-align:middle;margin-right:8px"></span> Création...';

      try {
        const res = await Http.post(API.register, data);
        Auth.save(res.tokens, res.user);
        btn.innerHTML = '✓ Compte créé ! Redirection...';
        btn.style.background = '#22C55E';
        setTimeout(() => { window.location.href = APP_ROOT + 'client-dashboard.html'; }, 800);
      } catch (err) {
        showErr(err.message || 'Erreur lors de la création du compte.');
        btn.disabled = false;
        btn.innerHTML = originalHTML;
        btn.style.background = '';
      }
    });
  },
};

/* CLIENT DASHBOARD */
const ClientDashboard = {
  async init() {
    if (!Auth.requireLogin()) return;
    Sidebar.init();
    Dropdown.init();
    this.fillUserInfo();
    await Promise.all([
      this.loadCredits(),
      this.loadNotifications(),
      this.loadInsurances(),
    ]);
  },

  fillUserInfo() {
    const user = Auth.getUser();
    if (!user) return;
    const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || '';
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
    setText('dashGreeting', `${greet}, ${user.first_name || 'cher client'} 👋`);
    setText('dashProfileName', name);
    setText('dashProfileEmail', user.email || '');
    const av = document.getElementById('dashProfileAvatar');
    if (av) av.textContent = Fmt.initials(name || user.email || 'U');
  },

  async loadCredits() {
    try {
      const data = await Http.get(API.credits);
      const credits = data.results || data || [];

      const active = credits.filter(c => ['APPROUVEE','DECAISSEE'].includes(c.statut));
      setText('stat-active-credits', active.length);

      const total = credits.reduce((s, c) => s + (c.montant_demande || 0), 0);
      setText('stat-total-montant', Fmt.money(total));

      // Répartition par statut → chart + labels
      const byStatus = {};
      credits.forEach(c => { byStatus[c.statut] = (byStatus[c.statut] || 0) + 1; });
      ['DECAISSEE','APPROUVEE','EN_ANALYSE','SOUMISE','REJETEE'].forEach(s => setText('lbl-'+s, byStatus[s]||0));
      this.initCharts(byStatus);

      // Activité récente
      const list = document.getElementById('recentActivityList');
      if (list) {
        if (!credits.length) {
          list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-title">Aucun crédit</div><div class="empty-state-desc" style="margin-top:12px"><a href="credit-request.html" class="btn btn-primary btn-sm">Faire une demande</a></div></div>`;
        } else {
          list.innerHTML = credits.slice(0, 5).map(c => `
            <div class="timeline-item">
              <div class="timeline-line">
                <div class="timeline-dot ${c.statut === 'DECAISSEE' ? 'success' : c.statut === 'REJETEE' ? 'danger' : ''}"></div>
                <div class="timeline-connector"></div>
              </div>
              <div class="timeline-content">
                <div class="timeline-header">
                  <span class="timeline-event">Crédit #${c.id} — ${Fmt.money(c.montant_demande)}</span>
                  <span class="timeline-time">${Fmt.date(c.date_soumission)}</span>
                </div>
                <div class="timeline-desc">${Fmt.statusBadge(c.statut)}</div>
              </div>
            </div>
          `).join('');
        }
      }
    } catch {
      setText('stat-active-credits', '0');
      setText('stat-total-montant', Fmt.money(0));
      this.initCharts({});
    }
    // Prochaine échéance
    const nb = document.getElementById('nextPaymentBlock');
    if (nb) {
      try {
        const user = Auth.getUser();
        const hist = await Http.get(API.repayHistory(user?.id));
        const pending = (hist?.results || hist || [])
          .filter(e => e.statut === 'EN_ATTENTE' || e.statut === 'EN_RETARD')
          .sort((a, b) => new Date(a.date_echeance) - new Date(b.date_echeance));
        if (pending.length) {
          const e = pending[0];
          nb.innerHTML = `
            <div style="font-size:2rem;font-weight:800;margin-bottom:4px">${Fmt.money(e.montant_du)} <span style="font-size:.9rem;font-weight:400;opacity:.8">FCFA</span></div>
            <div style="opacity:.75;font-size:.82rem">Échéance le ${Fmt.date(e.date_echeance)}</div>
            <div style="margin-top:12px"><a href="repayments.html" style="color:#fff;font-weight:600;font-size:.84rem;opacity:.9">Voir mes remboursements →</a></div>
          `;
        } else {
          nb.innerHTML = `<div style="text-align:center;opacity:.8;font-size:.875rem">Aucune échéance en attente ✓</div>`;
        }
      } catch {
        nb.innerHTML = `<div style="text-align:center;opacity:.7;font-size:.84rem"><a href="repayments.html" style="color:#fff">Voir les remboursements →</a></div>`;
      }
    }
  },

  async loadNotifications() {
    try {
      const data = await Http.get(API.notifCount);
      setText('stat-notifs', data.count || 0);
    } catch {
      setText('stat-notifs', '0');
    }
  },

  async loadInsurances() {
    try {
      const data = await Http.get(API.insurancePolicies);
      const policies = data.results || data || [];
      const active = policies.filter(p => p.statut === 'ACTIVE');
      setText('stat-insurances', active.length);
    } catch {
      setText('stat-insurances', '1');
    }
  },

  initCharts(byStatus = {}) {
    const ctx = document.getElementById('creditChart');
    if (!ctx || typeof Chart === 'undefined') return;

    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Décaissé', 'Approuvé', 'En analyse', 'Soumis', 'Rejeté'],
        datasets: [{
          data: [
            byStatus.DECAISSEE  || 0,
            byStatus.APPROUVEE  || 0,
            byStatus.EN_ANALYSE || 0,
            byStatus.SOUMISE    || 0,
            byStatus.REJETEE    || 0,
          ],
          backgroundColor: ['#22C55E', '#0F766E', '#3B82F6', '#F59E0B', '#EF4444'],
          borderWidth: 0,
          hoverOffset: 4,
        }],
      },
      options: {
        responsive: true,
        cutout: '70%',
        plugins: { legend: { display: false } },
      },
    });

    const ctx2 = document.getElementById('remboursementChart');
    if (!ctx2) return;
    new Chart(ctx2, {
      type: 'line',
      data: {
        labels: ['Jan','Fév','Mar','Avr','Mai','Juin'],
        datasets: [{
          label: 'Paiements (FCFA)',
          data: [0, 45000, 90000, 135000, 180000, 225000],
          borderColor: '#0F766E',
          backgroundColor: 'rgba(15,118,110,0.08)',
          tension: 0.4,
          fill: true,
          borderWidth: 2,
          pointBackgroundColor: '#0F766E',
          pointRadius: 4,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: '#F1F5F9' } },
          x: { grid: { display: false } },
        },
      },
    });
  },
};

/* CREDITS PAGE */
const CreditsPage = {
  async init() {
    if (!Auth.requireLogin()) return;
    Sidebar.init();
    Dropdown.init();
    await this.loadCredits();
  },

  async loadCredits() {
    const tbody = document.getElementById('creditsTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding:32px"><div class="spinner"></div></td></tr>';

    try {
      const data = await Http.get(API.credits);
      const credits = data.results || data || [];
      this.renderTable(tbody, credits);
    } catch {
      this.renderTable(tbody, []);
    }
  },

  renderTable(tbody, credits) {
    if (!credits.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-title">Aucune demande de crédit</div></div></td></tr>`;
      return;
    }
    const isStaff = ['AGENT', 'ADMIN'].includes(Auth.getUser()?.role);
    tbody.innerHTML = credits.map(c => `
      <tr>
        <td><span class="font-semibold text-primary">#${c.id}</span></td>
        <td>
          <div class="table-user">
            <div class="table-avatar">${Fmt.initials(c.client_name || c.client?.email || 'U')}</div>
            <div>
              <div class="table-user-name">${c.client_name || c.client?.email || '—'}</div>
            </div>
          </div>
        </td>
        <td class="amount fw-bold">${Fmt.money(c.montant_demande)}</td>
        <td>${Fmt.date(c.date_soumission)}</td>
        <td>${Fmt.statusBadge(c.statut)}</td>
        <td>${c.agent_name || c.agent?.email || '<span class="text-muted">Non assigné</span>'}</td>
        <td>
          <div class="table-actions">
            <a href="credit-request.html?id=${c.id}" class="btn btn-ghost btn-icon-sm" title="Voir">👁</a>
            ${isStaff && ['SOUMISE','EN_ANALYSE'].includes(c.statut) ? `
              <button class="btn btn-primary btn-sm" onclick="CreditsPage.changeStatus(${c.id},'APPROUVEE')">Approuver</button>
              <button class="btn btn-danger btn-sm" onclick="CreditsPage.changeStatus(${c.id},'REJETEE')">Rejeter</button>
            ` : ''}
          </div>
        </td>
      </tr>
    `).join('');
  },

  async changeStatus(id, statut) {
    if (!confirm(`Confirmer : passer le crédit #${id} en "${statut}" ?`)) return;
    try {
      await Http.patch(API.creditStatus(id), { statut });
      Toast.show('Statut mis à jour', 'success');
      this.loadCredits();
    } catch (err) {
      Toast.show('Erreur', 'error', err.message);
    }
  },
};

/* CREDIT REQUEST PAGE */
const CreditRequestPage = {
  async init() {
    if (!Auth.requireLogin()) return;
    Sidebar.init();
  },

  async submit(e) {
    e.preventDefault();
    const btn    = document.getElementById('submitBtn');
    const errEl  = document.getElementById('requestError');
    const montant = parseFloat(document.getElementById('montant')?.value) || 0;
    const duree   = parseInt(document.getElementById('duree_mois')?.value) || 0;
    const motif   = document.getElementById('motif')?.value || '';
    const desc    = document.getElementById('description')?.value || '';
    const taux    = parseFloat(document.getElementById('taux_interet')?.value) || 5;

    errEl.style.display = 'none';
    if (!montant || montant < 10000) { errEl.textContent = 'Montant minimum : 10 000 FCFA.'; errEl.style.display = 'block'; return; }
    if (!duree)  { errEl.textContent = 'Veuillez sélectionner une durée.'; errEl.style.display = 'block'; return; }
    if (!motif)  { errEl.textContent = 'Veuillez sélectionner un motif.'; errEl.style.display = 'block'; return; }

    const origHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span style="display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;vertical-align:middle;margin-right:8px"></span>Envoi…';

    try {
      await Http.post(API.credits, {
        montant_demande: montant,
        duree_mois: duree,
        taux_interet: taux,
        motif,
        description: desc,
      });
      btn.innerHTML = '✓ Demande envoyée !';
      btn.style.background = '#16a34a';
      Toast.show('Demande soumise !', 'success', 'Vous serez contacté sous 48h.');
      setTimeout(() => { window.location.href = APP_ROOT + 'credits.html'; }, 1200);
    } catch (err) {
      errEl.textContent = err?.message || 'Erreur lors de la soumission.';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.innerHTML = origHTML;
      btn.style.background = '';
    }
  },
};
window.CreditRequestPage = CreditRequestPage;

/* REPAYMENTS PAGE */
const RepaymentsPage = {
  async init() {
    if (!Auth.requireLogin()) return;
    Sidebar.init();
    await this.loadData();
  },

  async loadData() {
    const user = Auth.getUser();
    const isStaff = user && ['AGENT', 'ADMIN'].includes(user.role);
    try {
      if (isStaff) {
        // Agents et admins : retards globaux + historique si demandé
        const overdue = await Http.get(API.repayOverdue);
        this.renderOverdue(overdue || []);
      } else if (user) {
        // Clients : leur propre échéancier
        const hist = await Http.get(API.repayHistory(user.id)).catch(() => []);
        this.renderHistory(hist || []);
      }
    } catch {
      this.renderOverdue([]);
      this.renderHistory([]);
    }
  },

  renderOverdue(items) {
    const el = document.getElementById('overdueList');
    if (!el) return;
    if (!items.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-title">Aucun retard de paiement</div></div>`;
      return;
    }
    el.innerHTML = items.map(r => `
      <div class="echeance-row">
        <div class="echeance-num late">${r.numero_echeance}</div>
        <div class="flex-1">
          <div class="font-semibold">Crédit #${r.credit || r.credit_id}</div>
          <div class="text-sm text-muted">Échéance : ${Fmt.date(r.date_echeance)}</div>
        </div>
        <div class="text-right">
          <div class="amount fw-bold text-danger">${Fmt.money(r.montant_du)}</div>
          ${Fmt.statusBadge(r.statut)}
        </div>
        <button class="btn btn-primary btn-sm" onclick="RepaymentsPage.payEcheance(${r.id}, ${r.montant_du})">Payer</button>
      </div>
    `).join('');
  },

  renderHistory(items) {
    const el = document.getElementById('historyList');
    if (!el) return;
    el.innerHTML = items.map(r => `
      <div class="echeance-row">
        <div class="echeance-num ${r.statut === 'PAYEE' ? 'paid' : r.statut === 'EN_RETARD' ? 'late' : ''}">${r.numero_echeance}</div>
        <div class="flex-1">
          <div class="font-semibold">Échéance ${r.numero_echeance}</div>
          <div class="text-sm text-muted">${Fmt.date(r.date_echeance)}</div>
        </div>
        <div class="text-right">
          <div class="amount fw-bold">${Fmt.money(r.montant_du)}</div>
          ${Fmt.statusBadge(r.statut)}
        </div>
      </div>
    `).join('');
  },

  async payEcheance(id, montant) {
    if (!confirm(`Confirmer le paiement de ${Fmt.money(montant)} FCFA ?`)) return;
    try {
      await Http.post(API.repayPay, { echeance: id, montant_paye: montant });
      Toast.show('Paiement enregistré', 'success');
      this.loadData();
    } catch (err) {
      Toast.show('Erreur', 'error', err.message);
    }
  },
};

/* INSURANCE PAGE */
const InsurancePage = {
  async init() {
    if (!Auth.requireLogin()) return;
    Sidebar.init();
    const user = Auth.getUser();
    const isClient = !user || user.role === 'CLIENT';
    // Masquer l'onglet "Mes polices" pour les non-clients
    if (!isClient) {
      const tabPolices = document.querySelector('[onclick*="polices"]');
      if (tabPolices) tabPolices.style.display = 'none';
      const panelPolices = document.getElementById('tab-polices');
      if (panelPolices) panelPolices.style.display = 'none';
      const panelCatalogue = document.getElementById('tab-catalogue');
      if (panelCatalogue) panelCatalogue.style.display = '';
      // Activer le tab catalogue
      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
        if (b.getAttribute('onclick')?.includes('catalogue')) b.classList.add('active');
      });
    }
    await this.loadProducts();
    if (isClient) await this.loadPolicies();
  },

  async loadProducts() {
    try {
      const data = await Http.get(API.insuranceProducts);
      const products = data.results || data || [];
      this.renderProducts(products);
    } catch {
      this.renderProducts([]);
    }
  },

  renderProducts(products) {
    const el = document.getElementById('productsList');
    if (!el) return;
    const user = Auth.getUser();
    const isClient = !user || user.role === 'CLIENT';
    if (!products.length) {
      el.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px 24px">
        <div style="font-size:3rem;margin-bottom:16px">🛡</div>
        <p style="color:var(--t-muted)">Aucun produit d'assurance disponible pour le moment.</p>
      </div>`;
      return;
    }
    el.innerHTML = products.map(p => `
      <div class="insurance-card animate-fadeIn">
        <div class="insurance-card-header">
          <div style="font-size:.8rem;opacity:.8;margin-bottom:6px">${p.type_produit === 'VIE' ? '🛡 Assurance Vie' : '🏥 Décès & Invalidité'}</div>
          <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:8px">${p.nom}</h3>
          <div class="insurance-price">${Fmt.money(p.prime_mensuelle)} <span>/mois</span></div>
        </div>
        <div class="insurance-card-body">
          <p class="text-sm text-secondary" style="margin-bottom:16px">${p.description}</p>
          <div class="insurance-feature">Couverture max : <strong>${Fmt.money(p.couverture_max)}</strong></div>
          <div class="insurance-feature">Souscription immédiate en ligne</div>
          <div class="insurance-feature">Résiliation possible à tout moment</div>
          ${isClient ? `<div style="margin-top:20px">
            <button class="btn btn-primary w-full" onclick="openSubscribeModal(${p.id}, '${p.nom.replace(/'/g, "\\'")}')">
              Souscrire
            </button>
          </div>` : ''}
        </div>
      </div>
    `).join('');
  },

  async loadPolicies() {
    try {
      const data = await Http.get(API.insurancePolicies);
      const policies = data.results || data || [];
      this.renderPolicies(policies);
    } catch { }
  },

  renderPolicies(policies) {
    const el = document.getElementById('policiesList');
    if (!el) return;
    if (!policies.length) {
      el.innerHTML = `<div class="card" style="text-align:center;padding:48px 24px">
        <div style="font-size:3rem;margin-bottom:16px">🛡</div>
        <p style="color:var(--t-muted);margin-bottom:16px">Vous n'avez aucune police active.</p>
        <button class="btn btn-primary" onclick="showInsTab('catalogue', document.querySelectorAll('.tab-btn')[1])">Découvrir nos produits</button>
      </div>`;
      return;
    }
    el.innerHTML = policies.map(p => `
      <div class="card card-sm flex items-center gap-4 mb-3">
        <div class="stat-icon stat-icon-primary">🛡</div>
        <div class="flex-1">
          <div class="font-semibold">${p.produit_details?.nom || 'Police #' + p.id}</div>
          <div class="text-sm text-muted">Du ${Fmt.date(p.date_debut)} au ${Fmt.date(p.date_fin)}</div>
        </div>
        ${Fmt.statusBadge(p.statut)}
      </div>
    `).join('');
  },
};

/* NOTIFICATIONS PAGE */
const NotificationsPage = {
  async init() {
    if (!Auth.requireLogin()) return;
    Sidebar.init();
    await this.loadNotifications();

    document.getElementById('markAllRead')?.addEventListener('click', () => this.markAllRead());
  },

  async loadNotifications(filter = 'all') {
    const el = document.getElementById('notifList');
    if (!el) return;
    el.innerHTML = '<div class="spinner" style="margin:32px auto"></div>';

    try {
      const data = await Http.get(API.notifications);
      let notifs = data.results || data || [];
      if (filter === 'unread') notifs = notifs.filter(n => !n.lu);
      if (filter === 'read')   notifs = notifs.filter(n =>  n.lu);
      this.renderNotifications(el, notifs);
    } catch {
      this.renderNotifications(el, []);
    }
  },

  renderNotifications(el, notifs) {
    if (!notifs.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔔</div><div class="empty-state-title">Aucune notification</div></div>`;
      return;
    }
    const icons = {
      CREDIT_STATUT: { icon:'💳', cls:'stat-icon-primary' },
      REMBOURSEMENT: { icon:'💰', cls:'stat-icon-warning' },
      ASSURANCE_EXPIRATION: { icon:'🛡', cls:'stat-icon-success' },
      SUPPORT_MESSAGE: { icon:'💬', cls:'stat-icon-info' },
    };
    el.innerHTML = notifs.map(n => {
      const ic = icons[n.type_notif] || { icon:'🔔', cls:'stat-icon-muted' };
      return `
        <div class="notif-item ${n.lu ? '' : 'unread'}" onclick="NotificationsPage.markRead(${n.id}, this)">
          <div class="notif-icon ${ic.cls}">${ic.icon}</div>
          <div class="notif-body">
            <div class="notif-title">${n.titre}</div>
            <div class="notif-msg">${n.message}</div>
            <div class="notif-time">${Fmt.relativeTime(n.created_at)}</div>
          </div>
          ${!n.lu ? '<div class="notif-dot"></div>' : ''}
        </div>
      `;
    }).join('');
  },

  async markRead(id, el) {
    try {
      await Http.patch(API.notifRead(id), {});
      el.classList.remove('unread');
      el.querySelector('.notif-dot')?.remove();
      Sidebar.loadUnreadCount();
    } catch {}
  },

  async markAllRead() {
    try {
      await Http.patch(API.notifReadAll, {});
      Toast.show('Toutes les notifications lues', 'success');
      this.loadNotifications();
      Sidebar.loadUnreadCount();
    } catch (err) {
      Toast.show('Erreur', 'error', err.message);
    }
  },
};

/* CHAT PAGE */
const ChatPage = {
  ws: null,
  currentConvId: null,
  activeConvId: null,
  currentUserId: null,
  allConversations: [],

  async init() {
    if (!Auth.requireLogin()) return;
    Sidebar.init();

    const user = Auth.getUser();
    this.currentUserId = user?.id;

    await this.loadConversations();

    window.newConversation     = () => this.createConversation();
    window.sendMessage         = () => this.sendMessage();
    window.handleChatKey       = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(); } };
    window.filterConversations = (q) => this._filterConversations(q);

    // Auto-resize textarea
    const inp = document.getElementById('chatInput');
    if (inp) {
      inp.addEventListener('input', () => {
        inp.style.height = '';
        inp.style.height = Math.min(inp.scrollHeight, 120) + 'px';
      });
    }
  },

  async loadConversations() {
    const el = document.getElementById('convList');
    if (!el) return;
    try {
      const data = await Http.get(API.conversations);
      this.allConversations = data.results || data || [];
      this._renderConversations(el, this.allConversations);
    } catch {
      this.allConversations = [];
      this._renderConversations(el, []);
    }
  },

  _filterConversations(q) {
    const el = document.getElementById('convList');
    if (!el) return;
    const lower = (q || '').toLowerCase();
    const filtered = lower
      ? this.allConversations.filter(c => {
          const name = (c.client_name || '') + ' ' + (c.agent_name || '');
          return name.toLowerCase().includes(lower) || (c.last_message || '').toLowerCase().includes(lower);
        })
      : this.allConversations;
    this._renderConversations(el, filtered);
  },

  _convDisplayName(c) {
    const user = Auth.getUser();
    if (user?.role === 'CLIENT') return c.agent_name || 'Agent COFINANCE CI';
    return c.client_name || 'Client #' + c.id;
  },

  _renderConversations(el, convs) {
    if (!convs.length) {
      el.innerHTML = '<div class="conv-list-empty">Aucune conversation</div>';
      return;
    }
    el.innerHTML = convs.map(c => {
      const name = this._convDisplayName(c);
      const isActive = c.id === this.currentConvId;
      return `
        <div class="conv-item${isActive ? ' active' : ''}" onclick="ChatPage.openConversation(${c.id})">
          <div class="conv-avatar-wrap">
            <div class="conv-avatar">${Fmt.initials(name)}</div>
            ${c.statut === 'EN_COURS' ? '<div class="online-dot"></div>' : ''}
          </div>
          <div class="conv-body">
            <div class="conv-name">${name}</div>
            <div class="conv-preview">${c.last_message || 'Démarrer la conversation…'}</div>
          </div>
          <div class="conv-meta">
            <div class="conv-time">${Fmt.relativeTime(c.updated_at)}</div>
            ${c.unread > 0 ? `<div class="conv-unread">${c.unread}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
  },

  async openConversation(id) {
    this.currentConvId = id;
    this.activeConvId  = id;

    const conv = this.allConversations.find(c => c.id === id);
    const name = conv ? this._convDisplayName(conv) : 'COFINANCE CI';

    // Show active panel
    const empty  = document.getElementById('chatEmptyState');
    const active = document.getElementById('chatActive');
    if (empty)  empty.style.display = 'none';
    if (active) { active.style.display = 'flex'; active.style.flexDirection = 'column'; active.style.overflow = 'hidden'; active.style.flex = '1'; }

    // Highlight selected conversation
    document.querySelectorAll('.conv-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.conv-item').forEach(el => {
      if (el.getAttribute('onclick')?.includes(`(${id})`)) el.classList.add('active');
    });

    // Update header
    const avatar = document.getElementById('chatPartnerAvatar');
    const nameEl = document.getElementById('chatPartnerName');
    const subEl  = document.getElementById('chatPartnerStatus');
    if (avatar) avatar.innerHTML = Fmt.initials(name) + '<span class="status-ring"></span>';
    if (nameEl) nameEl.textContent = name;
    if (subEl)  subEl.textContent = conv?.statut === 'EN_COURS' ? 'En ligne' : 'Hors ligne';

    const badge = document.getElementById('chatStatusBadge');
    if (badge && conv) {
      const map = { EN_COURS: ['badge-success', 'Actif'], FERMEE: ['badge-muted', 'Fermé'] };
      const [cls, label] = map[conv.statut] || ['badge-muted', conv.statut];
      badge.innerHTML = `<span class="badge ${cls}">${label}</span>`;
    }

    // Hide typing indicator
    const ti = document.getElementById('typingIndicator');
    if (ti) ti.style.display = 'none';

    await this.loadMessages(id);
    this.connectWS(id);
  },

  async loadMessages(id) {
    const el = document.getElementById('chatMessages');
    if (!el) return;
    el.innerHTML = '<div style="display:flex;justify-content:center;padding:32px"><div class="spinner"></div></div>';
    try {
      const data = await Http.get(API.chatMessages(id));
      const msgs = data.results || data || [];
      this._renderMessages(el, msgs);
    } catch {
      this._renderMessages(el, []);
    }
  },

  _renderMessages(el, msgs) {
    if (!msgs.length) {
      el.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;padding:40px;color:var(--t-muted);text-align:center">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--border)" stroke-width="1.5" style="margin-bottom:16px"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          <div style="font-weight:600;color:var(--t-second);margin-bottom:6px">Aucun message</div>
          <div style="font-size:.84rem">Envoyez le premier message pour démarrer la conversation.</div>
        </div>`;
      return;
    }
    el.innerHTML = msgs.map(m => this.buildBubble(m)).join('');
    el.scrollTop = el.scrollHeight;
  },

  buildBubble(m) {
    const mine = m.auteur === this.currentUserId || m.auteur_id === this.currentUserId;
    const name = m.auteur_name || 'Utilisateur';
    const time = Fmt.relativeTime(m.timestamp);
    return `
      <div class="msg-group ${mine ? 'mine' : 'theirs'}">
        ${!mine ? `<div class="msg-sender-name">${name}</div>` : ''}
        <div class="msg-row">
          ${!mine ? `<div class="msg-avatar">${Fmt.initials(name)}</div>` : ''}
          <div>
            <div class="msg-bubble ${mine ? 'sent' : 'received'}">${m.contenu}</div>
            <div class="msg-time">${time}</div>
          </div>
        </div>
      </div>
    `;
  },

  connectWS(id) {
    if (this.ws) { this.ws.close(); }
    const token = Auth.getToken();
    const url   = `${API.wsChat(id)}?token=${token}`;
    this.ws = new WebSocket(url);

    this.ws.onmessage = (ev) => {
      const data = JSON.parse(ev.data);
      if (data.type === 'message') {
        const el = document.getElementById('chatMessages');
        if (el) {
          // Remove empty state if present
          const empty = el.querySelector('.msg-empty');
          if (empty) empty.remove();
          el.insertAdjacentHTML('beforeend', this.buildBubble(data.message));
          el.scrollTop = el.scrollHeight;
        }
        // Update conversation preview
        const conv = this.allConversations.find(c => c.id === id);
        if (conv) { conv.last_message = data.message?.contenu; conv.unread = 0; }
      } else if (data.type === 'typing') {
        const ti    = document.getElementById('typingIndicator');
        const label = document.getElementById('typingLabel');
        if (ti) ti.style.display = data.is_typing ? 'flex' : 'none';
        if (label && data.is_typing) label.textContent = `${data.user_name || 'Quelqu\'un'} est en train d'écrire…`;
      }
    };

    this.ws.onopen  = () => {
      const sub = document.getElementById('chatPartnerStatus');
      if (sub) sub.textContent = 'En ligne';
    };
    this.ws.onclose = () => {
      const sub = document.getElementById('chatPartnerStatus');
      if (sub) sub.textContent = 'Déconnecté';
    };
  },

  sendMessage() {
    const input = document.getElementById('chatInput');
    if (!input) return;
    const content = input.value.trim();
    if (!content || !this.currentConvId) return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'message', content }));
    } else {
      Http.post(API.chatMessages(this.currentConvId), { contenu: content })
        .then(() => this.loadMessages(this.currentConvId))
        .catch(err => Toast.show('Erreur', 'error', err.message));
    }
    input.value = '';
    input.style.height = '';
  },

  async createConversation() {
    const user = Auth.getUser();
    if (user?.role !== 'CLIENT') { Toast.show('Réservé aux clients', 'error'); return; }
    try {
      const conv = await Http.post(API.conversations, {});
      Toast.show('Conversation ouverte', 'success');
      await this.loadConversations();
      this.openConversation(conv.id);
    } catch (err) {
      Toast.show('Erreur', 'error', err.message);
    }
  },
};

/* AGENT DASHBOARD */
const AgentDashboard = {
  async init() {
    if (!Auth.requireLogin(['AGENT'])) return;
    Sidebar.init();
    this.fillUserInfo();
    await Promise.all([this.loadStats(), this.loadMyCredits()]);
  },

  fillUserInfo() {
    const user = Auth.getUser();
    if (!user) return;
    const name = `${user.first_name||''} ${user.last_name||''}`.trim() || user.email;
    const initials = Fmt.initials(name || user.email || 'A');
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
    setText('agentGreeting', `${greet}, ${user.first_name || 'Agent'} 👋`);
    setText('agentProfileName',   name);
    setText('agentProfileNameSm', name);
    const av1 = document.getElementById('agentAvatar');
    const av2 = document.getElementById('agentProfileAvatarSm');
    if (av1) av1.textContent = initials;
    if (av2) av2.textContent = initials;
  },

  async loadStats() {
    try {
      const s = await Http.get(API.dashStats);
      const ps = s?.credits?.par_statut || {};
      setText('agent-stat-total',   s?.credits?.total ?? 0);
      setText('agent-stat-pending', (ps.SOUMISE||0) + (ps.EN_ANALYSE||0));
      setText('agent-stat-support', s?.support?.conversations_ouvertes ?? 0);
      setText('agent-stat-late',    s?.remboursements?.echeances_en_retard ?? 0);
      ['SOUMISE','EN_ANALYSE','APPROUVEE','DECAISSEE','REJETEE'].forEach(k => setText('agl-'+k, ps[k]||0));
      this.initChart(ps);
    } catch (err) {
      ['agent-stat-total','agent-stat-pending','agent-stat-support','agent-stat-late'].forEach(id => setText(id,'0'));
      Toast.show('Statistiques', 'error', err?.message || 'Impossible de charger les données');
    }
  },

  async loadMyCredits() {
    const el = document.getElementById('agentCreditsList');
    if (!el) return;
    try {
      const data = await Http.get(API.credits);
      const credits = (data?.results || data || []).slice(0, 8);
      if (!credits.length) {
        el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-title">Aucun crédit assigné</div><div class="empty-state-desc">Les dossiers qui vous sont assignés apparaîtront ici</div></div>`;
        return;
      }
      const sc = { SOUMISE:'stat-icon-warning', EN_ANALYSE:'stat-icon-sky', APPROUVEE:'stat-icon-success', DECAISSEE:'stat-icon-primary', REJETEE:'stat-icon-danger' };
      const sl = { SOUMISE:'Soumise', EN_ANALYSE:'En analyse', APPROUVEE:'Approuvée', DECAISSEE:'Décaissée', REJETEE:'Rejetée' };
      el.innerHTML = credits.map(c => `
        <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-sm)">
          <div class="stat-icon ${sc[c.statut]||'stat-icon-primary'}" style="width:36px;height:36px;font-size:.85rem;flex-shrink:0">💳</div>
          <div style="min-width:0;flex:1">
            <div style="font-size:.84rem;font-weight:600;color:var(--t-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.client_name||'Client #'+c.id}</div>
            <div style="font-size:.75rem;color:var(--t-muted)">${Fmt.money(c.montant_demande)} FCFA · ${Fmt.date(c.date_soumission)}</div>
          </div>
          <span style="flex-shrink:0;font-size:.72rem;font-weight:600;padding:2px 8px;border-radius:20px;background:rgba(0,0,0,.06);color:var(--t-secondary)">${sl[c.statut]||c.statut}</span>
        </div>
      `).join('');
    } catch {
      el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--t-muted);font-size:.84rem">Activité non disponible</div>';
    }
  },

  initChart(ps) {
    const ctx = document.getElementById('agentCreditChart');
    if (!ctx || typeof Chart === 'undefined') return;
    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Soumise','En analyse','Approuvée','Décaissée','Rejetée'],
        datasets: [{
          data: [ps.SOUMISE||0, ps.EN_ANALYSE||0, ps.APPROUVEE||0, ps.DECAISSEE||0, ps.REJETEE||0],
          backgroundColor: ['#F59E0B','#3B82F6','#0F766E','#22C55E','#EF4444'],
          borderWidth: 0,
          hoverOffset: 4,
        }],
      },
      options: {
        responsive: true,
        cutout: '65%',
        plugins: { legend: { position:'bottom', labels:{ padding:12, font:{ size:11 } } } },
      },
    });
  },
};
window.AgentDashboard = AgentDashboard;

/* ADMIN DASHBOARD */
const AdminDashboard = {
  async init() {
    if (!Auth.requireLogin(['ADMIN'])) return;
    Sidebar.init();
    Dropdown.init();
    await Promise.all([this.loadStats(), this.loadRecentActivity()]);
  },

  async loadStats() {
    try {
      const stats = await Http.get(API.dashStats);
      this.renderStats(stats || {});
      this.initCharts(stats);
    } catch(err) {
      this.renderStats({});
      this.initCharts(null);
      Toast.show('Statistiques', 'error', err?.message || 'Impossible de charger les données');
    }
  },

  renderStats(s) {
    const ps = s?.credits?.par_statut || {};
    const pending = (ps.SOUMISE || 0) + (ps.EN_ANALYSE || 0);
    setText('stat-clients',    s?.clients_total ?? 0);
    setText('stat-credits',    s?.credits?.total ?? 0);
    setText('stat-pending',    pending);
    setText('stat-disbursed',  ps.DECAISSEE ?? 0);
    setText('stat-insurances', s?.assurances?.polices_actives ?? 0);
    setText('stat-late',       s?.remboursements?.echeances_en_retard ?? 0);
  },

  async loadRecentActivity() {
    const el = document.getElementById('recentActivity');
    if (!el) return;
    try {
      const data = await Http.get(API.credits);
      const items = (data?.results || data || []).slice(0, 6);
      if (!items.length) {
        el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--t-muted);font-size:.84rem">Aucune activité récente</div>';
        return;
      }
      const sc = { SOUMISE:'stat-icon-warning', EN_ANALYSE:'stat-icon-sky', APPROUVEE:'stat-icon-success', DECAISSEE:'stat-icon-primary', REJETEE:'stat-icon-danger' };
      const sl = { SOUMISE:'Soumise', EN_ANALYSE:'En analyse', APPROUVEE:'Approuvée', DECAISSEE:'Décaissée', REJETEE:'Rejetée' };
      el.innerHTML = items.map(c => `
        <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-sm)">
          <div class="stat-icon ${sc[c.statut]||'stat-icon-primary'}" style="width:36px;height:36px;font-size:.85rem;flex-shrink:0">💳</div>
          <div style="min-width:0;flex:1">
            <div style="font-size:.84rem;font-weight:600;color:var(--t-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
              ${c.client_name || 'Client #' + c.id}
            </div>
            <div style="font-size:.75rem;color:var(--t-muted)">${Fmt.money(c.montant_demande)} FCFA · ${Fmt.date(c.date_soumission)}</div>
          </div>
          <span style="flex-shrink:0;font-size:.72rem;font-weight:600;padding:2px 8px;border-radius:20px;background:rgba(0,0,0,.06);color:var(--t-secondary)">${sl[c.statut]||c.statut}</span>
        </div>
      `).join('');
    } catch {
      el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--t-muted);font-size:.84rem">Activité non disponible</div>';
    }
  },

  initCharts(stats) {
    // Bar Chart — Crédits par statut
    const barCtx = document.getElementById('creditsStatusChart');
    if (barCtx && typeof Chart !== 'undefined') {
      const parStatut = stats?.credits?.par_statut || { SOUMISE:5, EN_ANALYSE:8, APPROUVEE:12, DECAISSEE:15, REJETEE:3 };
      new Chart(barCtx, {
        type: 'bar',
        data: {
          labels: ['Soumise','En analyse','Approuvée','Décaissée','Rejetée'],
          datasets: [{
            label: 'Nombre de crédits',
            data: [parStatut.SOUMISE||0, parStatut.EN_ANALYSE||0, parStatut.APPROUVEE||0, parStatut.DECAISSEE||0, parStatut.REJETEE||0],
            backgroundColor: ['#F59E0B','#3B82F6','#0F766E','#22C55E','#EF4444'],
            borderRadius: 8,
            borderSkipped: false,
          }],
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, grid: { color: '#F1F5F9' }, ticks: { stepSize: 1 } },
            x: { grid: { display: false } },
          },
        },
      });
    }

    // Pie Chart — Assurances
    const pieCtx = document.getElementById('insurancePieChart');
    if (pieCtx && typeof Chart !== 'undefined') {
      new Chart(pieCtx, {
        type: 'doughnut',
        data: {
          labels: ['Assurance Vie', 'Décès & Invalidité', 'Premium'],
          datasets: [{
            data: [12, 5, 3],
            backgroundColor: ['#0F766E','#F59E0B','#3B82F6'],
            borderWidth: 0,
            hoverOffset: 4,
          }],
        },
        options: {
          responsive: true,
          cutout: '65%',
          plugins: { legend: { position: 'bottom', labels: { padding: 16, font: { size: 12 } } } },
        },
      });
    }

    // Line Chart — Évolution mensuelle
    const lineCtx = document.getElementById('trendLineChart');
    if (lineCtx && typeof Chart !== 'undefined') {
      new Chart(lineCtx, {
        type: 'line',
        data: {
          labels: ['Jan','Fév','Mar','Avr','Mai','Juin'],
          datasets: [
            {
              label: 'Crédits décaissés (KFCFA)',
              data: [800, 1200, 950, 1500, 1100, 1800],
              borderColor: '#0F766E',
              backgroundColor: 'rgba(15,118,110,0.08)',
              tension: 0.4, fill: true, borderWidth: 2,
              pointBackgroundColor: '#0F766E', pointRadius: 4,
            },
            {
              label: 'Remboursements (KFCFA)',
              data: [300, 500, 450, 700, 600, 900],
              borderColor: '#F59E0B',
              backgroundColor: 'rgba(245,158,11,0.06)',
              tension: 0.4, fill: true, borderWidth: 2,
              pointBackgroundColor: '#F59E0B', pointRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          interaction: { mode: 'index', intersect: false },
          plugins: { legend: { position: 'top', labels: { padding: 16, font: { size: 12 } } } },
          scales: {
            y: { beginAtZero: true, grid: { color: '#F1F5F9' } },
            x: { grid: { display: false } },
          },
        },
      });
    }
  },
};

/* ADMIN CLIENTS */
const AdminClients = {
  allClients: [],
  async init() {
    if (!Auth.requireLogin(['ADMIN', 'AGENT'])) return;
    Sidebar.init();
    try {
      const data = await Http.get(API.clients);
      this.allClients = data.results || data || [];
    } catch {
      this.allClients = [];
    }
    this.render(this.allClients);

    document.getElementById('clientSearch')?.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      const filtered = this.allClients.filter(c =>
        `${c.first_name} ${c.last_name} ${c.email} ${c.ville}`.toLowerCase().includes(q)
      );
      this.render(filtered);
    });

    document.getElementById('regionFilter')?.addEventListener('change', (e) => {
      const r = e.target.value;
      const filtered = r ? this.allClients.filter(c => c.region === r) : this.allClients;
      this.render(filtered);
    });
  },

  render(clients) {
    const tbody = document.getElementById('clientsTableBody');
    if (!tbody) return;
    tbody.innerHTML = clients.map(c => `
      <tr>
        <td>
          <div class="table-user">
            <div class="table-avatar">${Fmt.initials(c.first_name + ' ' + c.last_name)}</div>
            <div>
              <div class="table-user-name">${c.first_name} ${c.last_name}</div>
              <div class="table-user-email">${c.email}</div>
            </div>
          </div>
        </td>
        <td>${c.phone || '—'}</td>
        <td>${c.ville}, ${c.region}</td>
        <td>${Fmt.date(c.created_at)}</td>
        <td>
          <span class="badge ${c.is_active ? 'badge-success' : 'badge-danger'}">
            ${c.is_active ? 'Actif' : 'Suspendu'}
          </span>
        </td>
        <td>
          <div class="table-actions">
            <button class="btn btn-ghost btn-icon-sm" title="Voir profil">👁</button>
            <button class="btn btn-ghost btn-icon-sm" title="Éditer">✏️</button>
            <button class="btn btn-${c.is_active ? 'danger' : 'success'} btn-sm"
              onclick="AdminClients.toggleStatus(${c.id}, ${!c.is_active})">
              ${c.is_active ? 'Suspendre' : 'Activer'}
            </button>
          </div>
        </td>
      </tr>
    `).join('');
    setText('clientCount', `${clients.length} client(s)`);
  },

  toggleStatus(id, newStatus) {
    const c = this.allClients.find(x => x.id === id);
    if (c) { c.is_active = newStatus; this.render(this.allClients); Toast.show('Statut mis à jour', 'success'); }
  },
};

/* ADMIN CREDITS KANBAN */
const AdminCreditsKanban = {
  credits: [],
  pendingId: null,

  async init() {
    if (!Auth.requireLogin(['ADMIN', 'AGENT'])) return;
    Sidebar.init();
    await this.load();
  },

  async load() {
    try {
      const data = await Http.get(API.credits);
      this.credits = data.results || data || [];
    } catch {
      this.credits = [];
    }
    this.buildBoard();
    this.render();
    this.initDragDrop();
  },

  reload() { this.load(); },

  buildBoard() {
    const board = document.getElementById('kanbanBoard');
    if (!board) return;
    const COLS = [
      { key:'SOUMISE',    label:'Soumise',    cls:'stat-icon-warning' },
      { key:'EN_ANALYSE', label:'En analyse', cls:'stat-icon-sky' },
      { key:'APPROUVEE',  label:'Approuvée',  cls:'stat-icon-success' },
      { key:'DECAISSEE',  label:'Décaissée',  cls:'stat-icon-primary' },
      { key:'REJETEE',    label:'Rejetée',    cls:'stat-icon-danger' },
    ];
    board.innerHTML = COLS.map(c => `
      <div class="kanban-col">
        <div class="kanban-col-header">
          <span class="kanban-col-title">${c.label}</span>
          <span class="badge" id="count-${c.key}">0</span>
        </div>
        <div class="kanban-col-body" id="col-${c.key}" data-statut="${c.key}"></div>
      </div>
    `).join('');
  },

  render() {
    const cols = ['SOUMISE','EN_ANALYSE','APPROUVEE','DECAISSEE','REJETEE'];
    cols.forEach(statut => {
      const col = document.getElementById(`col-${statut}`);
      if (!col) return;
      const items = this.credits.filter(c => c.statut === statut);
      col.innerHTML = items.length ? items.map(c => `
        <div class="kanban-card" draggable="true" data-id="${c.id}" data-statut="${c.statut}" onclick="AdminCreditsKanban.openCard(${c.id})">
          <div class="kanban-card-title">Crédit #${c.id} — ${c.client_name || 'Client'}</div>
          <div style="font-size:.8rem;color:var(--t-muted);margin:6px 0">${c.motif || '—'}</div>
          <div class="kanban-card-meta">
            <span style="font-weight:700;color:var(--c-primary)">${Fmt.money(c.montant_demande)}</span>
            <span style="font-size:.75rem;color:var(--t-muted)">${Fmt.date(c.date_soumission)}</span>
          </div>
          ${c.agent_name ? `<div style="font-size:.75rem;color:var(--t-muted);margin-top:8px">👤 ${c.agent_name}</div>` : ''}
        </div>
      `).join('') : `<div style="text-align:center;padding:24px;color:var(--t-light);font-size:.82rem">Aucune demande</div>`;

      const countEl = document.getElementById(`count-${statut}`);
      if (countEl) countEl.textContent = items.length;
    });
  },

  openCard(id) {
    const c = this.credits.find(x => x.id == id);
    if (!c) return;
    this.pendingId = id;
    const desc = document.getElementById('statusChangeDesc');
    if (desc) desc.textContent = `Crédit #${id} — ${c.client_name || 'Client'} — ${Fmt.money(c.montant_demande)} FCFA`;
    const sel = document.getElementById('newStatusSelect');
    if (sel) sel.value = c.statut;
    // Charger les agents dans le select
    Http.get(API.agents).then(data => {
      const agents = data?.results || data || [];
      const agSel = document.getElementById('agentSelectKanban');
      if (agSel) {
        agSel.innerHTML = '<option value="">— Sans agent —</option>' +
          agents.map(a => `<option value="${a.id}" ${c.agent == a.id ? 'selected' : ''}>${a.first_name} ${a.last_name}</option>`).join('');
      }
    }).catch(() => {});
    Modal.open('statusChangeModal');
  },

  initDragDrop() {
    document.querySelectorAll('.kanban-card').forEach(card => {
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', card.dataset.id);
        card.classList.add('dragging');
      });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
    });

    document.querySelectorAll('.kanban-col-body').forEach(col => {
      col.addEventListener('dragover',  (e) => { e.preventDefault(); col.classList.add('drag-over'); });
      col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
      col.addEventListener('drop', async (e) => {
        e.preventDefault();
        col.classList.remove('drag-over');
        const id = e.dataTransfer.getData('text/plain');
        const newStatus = col.dataset.statut;
        try {
          await Http.patch(API.creditStatus(id), { statut: newStatus });
          const credit = this.credits.find(c => c.id == id);
          if (credit) { credit.statut = newStatus; this.render(); this.initDragDrop(); }
          Toast.show('Statut mis à jour', 'success');
        } catch (err) {
          Toast.show('Erreur', 'error', err.message);
        }
      });
    });
  },
};

window.AdminCreditsKanban = AdminCreditsKanban;
async function confirmStatusChange() {
  const id      = AdminCreditsKanban.pendingId;
  const statut  = document.getElementById('newStatusSelect')?.value;
  const agentId = document.getElementById('agentSelectKanban')?.value;
  if (!id || !statut) return;
  try {
    const payload = { statut };
    if (agentId) payload.agent = parseInt(agentId);
    await Http.patch(API.creditStatus(id), payload);
    const credit = AdminCreditsKanban.credits.find(c => c.id == id);
    if (credit) credit.statut = statut;
    Modal.close('statusChangeModal');
    AdminCreditsKanban.render();
    AdminCreditsKanban.initDragDrop();
    Toast.show('Statut mis à jour', 'success');
  } catch (err) {
    Toast.show('Erreur', 'error', err.message);
  }
}
window.confirmStatusChange = confirmStatusChange;

/* ADMIN SUPPORT */
const AdminSupport = {
  async init() {
    if (!Auth.requireLogin(['ADMIN', 'AGENT'])) return;
    Sidebar.init();
    await this.loadConversations();
  },

  async loadConversations() {
    const el = document.getElementById('supportConvList');
    if (!el) return;
    try {
      const data = await Http.get(API.conversations);
      const convs = data.results || data || [];
      this.render(el, convs);
    } catch {
      this.render(el, []);
    }
  },

  render(el, convs) {
    el.innerHTML = convs.map(c => `
      <div class="card card-sm mb-3" style="cursor:pointer">
        <div class="flex items-center gap-3">
          <div class="conv-avatar">${Fmt.initials(c.client_name || 'C')}</div>
          <div class="flex-1">
            <div class="font-semibold">${c.client_name || 'Client #' + c.id}</div>
            <div class="text-sm text-muted truncate">${c.last_message || '—'}</div>
            <div class="text-xs text-muted">${Fmt.relativeTime(c.updated_at)}</div>
          </div>
          <div class="flex flex-col items-end gap-2">
            ${Fmt.statusBadge(c.statut)}
            ${!c.agent_name ? `<button class="btn btn-primary btn-sm" onclick="AdminSupport.assign(${c.id})">Assigner</button>` : `<span class="text-xs text-muted">👤 ${c.agent_name}</span>`}
          </div>
        </div>
      </div>
    `).join('');
  },

  async assign(id) {
    const agentId = prompt('ID de l\'agent à assigner :');
    if (!agentId) return;
    try {
      await Http.patch(API.chatAssign(id), { agent_id: parseInt(agentId) });
      Toast.show('Agent assigné', 'success');
      this.loadConversations();
    } catch (err) {
      Toast.show('Erreur', 'error', err.message);
    }
  },
};

/* PROFILE PAGE */
const ProfilePage = {
  async init() {
    if (!Auth.requireLogin()) return;
    Sidebar.init();
    const user = Auth.getUser();
    if (!user) return;

    // Adapter la sidebar selon le rôle sur la page profil
    if (user.role !== 'CLIENT') {
      const nav = document.querySelector('.sidebar-nav');
      if (nav) {
        if (user.role === 'AGENT') {
          nav.innerHTML = `
            <div class="nav-section-label">Mon espace</div>
            <a href="agent-dashboard.html" class="nav-item">Tableau de bord</a>
            <a href="admin-credits.html" class="nav-item">Mes crédits</a>
            <a href="admin-support.html" class="nav-item">Support client</a>
          `;
        } else {
          nav.innerHTML = `
            <div class="nav-section-label">Administration</div>
            <a href="admin-dashboard.html" class="nav-item">Tableau de bord</a>
            <a href="admin-clients.html" class="nav-item">Clients</a>
            <a href="admin-agents.html" class="nav-item">Agents</a>
            <a href="admin-credits.html" class="nav-item">Crédits (Kanban)</a>
            <a href="admin-insurances.html" class="nav-item">Assurances</a>
            <a href="admin-support.html" class="nav-item">Support</a>
          `;
        }
      }
    }

    // Pre-fill form
    document.querySelectorAll('[data-user-field]').forEach(el => {
      const field = el.dataset.userField;
      el.value = user[field] || '';
    });

    // Display name
    const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
    setText('profileName', name);
    setText('profileRole', { CLIENT:'Client', AGENT:'Agent', ADMIN:'Administrateur' }[user.role]);
    setText('profileEmail', user.email);
    document.querySelectorAll('.profile-avatar-lg').forEach(el => el.textContent = Fmt.initials(name));

    // Load fresh data
    try {
      const fresh = await Http.get(API.profile);
      sessionStorage.setItem('user', JSON.stringify(fresh.data || fresh));
    } catch {}

    // Save form
    document.getElementById('profileForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('[type="submit"]');
      const origHTML = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span style="display:inline-block;width:14px;height:14px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:spin .7s linear infinite;vertical-align:middle;margin-right:6px"></span> Enregistrement...';

      const data = {};
      document.querySelectorAll('[data-user-field]').forEach(el => {
        if (el.disabled) return;             // ignorer les champs désactivés (ex: email)
        const val = el.value.trim();
        if (val !== '') data[el.dataset.userField] = val;  // n'envoyer que les champs non-vides
      });

      try {
        const updated = await Http.patch(API.profile, data);
        const u = updated.data || updated;
        sessionStorage.setItem('user', JSON.stringify(u));
        Toast.show('Profil mis à jour', 'success');
        Sidebar.fillUser();
      } catch (err) {
        Toast.show('Erreur lors de la mise à jour', 'error', err.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = origHTML;
      }
    });
  },
};

/* ─── INIT ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  // Global event bindings
  Dropdown.init();
  Tabs.init();

  // Close modals on overlay click
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) Modal.closeAll();
  });

  // Expose globals for HTML onclick handlers
  window.Toast           = Toast;
  window.Modal           = Modal;
  window.Auth            = Auth;
  window.Fmt             = Fmt;
  window.CreditsPage     = CreditsPage;
  window.RepaymentsPage  = RepaymentsPage;
  window.InsurancePage   = InsurancePage;
  window.NotificationsPage = NotificationsPage;
  window.ChatPage        = ChatPage;
  window.AdminClients    = AdminClients;
  window.AdminCreditsKanban = AdminCreditsKanban;
  window.AdminSupport    = AdminSupport;
  window.AgentDashboard  = AgentDashboard;

  // Determine page and run init
  const page = document.body.dataset.page;
  const pageMap = {
    // login + register ont leur propre handler inline — ne pas les mettre ici
    'client-dashboard': ClientDashboard.init.bind(ClientDashboard),
    'agent-dashboard':  AgentDashboard.init.bind(AgentDashboard),
    'credits':         CreditsPage.init.bind(CreditsPage),
    'credit-request':  CreditRequestPage.init.bind(CreditRequestPage),
    // repayments.html remplace RepaymentsPage.init localement — géré par inline script
    'insurance':       InsurancePage.init.bind(InsurancePage),
    'notifications':   NotificationsPage.init.bind(NotificationsPage),
    'chat':            ChatPage.init.bind(ChatPage),
    'admin-dashboard': AdminDashboard.init.bind(AdminDashboard),
    // admin-clients + admin-support gèrent leur propre init via inline script (comme repayments)
    'admin-credits':   AdminCreditsKanban.init.bind(AdminCreditsKanban),
    'profile':         ProfilePage.init.bind(ProfilePage),
  };
  if (page && pageMap[page]) pageMap[page]();

  // Sidebar init for any app page
  if (document.getElementById('sidebar')) Sidebar.init();

  // Logout handler
  document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm('Voulez-vous vous déconnecter ?')) Auth.logout();
  });
});
