/* ============================================================
   COFINANCE CI — Core JavaScript (partagé par toutes les pages)
   Contient : API, Auth, Http, Toast, Modal, Loader,
              Sidebar, Dropdown, Tabs, Fmt
   ============================================================ */

'use strict';

/* ─── CONFIGURATION API ─────────────────────────────────── */
const API_BASE = (() => {
  const loc = window.location;
  const onDjango = (loc.protocol === 'http:' || loc.protocol === 'https:') &&
                   (loc.hostname === '127.0.0.1' || loc.hostname === 'localhost') &&
                   loc.port === '8000';
  return onDjango ? '' : 'http://127.0.0.1:8000';
})();

const APP_ROOT = (() => {
  if (window.location.pathname.startsWith('/app/')) return '/app/';
  const parts = window.location.pathname.split('/');
  parts.pop();
  return parts.join('/') + '/';
})();

const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = String(val ?? ''); };

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
  login:         `${API_BASE}/api/auth/login/`,
  register:      `${API_BASE}/api/auth/register/`,
  tokenRefresh:  `${API_BASE}/api/auth/token/refresh/`,
  profile:       `${API_BASE}/api/auth/profile/`,
  credits:       `${API_BASE}/api/credits/`,
  creditStatus:  (id) => `${API_BASE}/api/credits/${id}/status/`,
  creditSchedule:(id) => `${API_BASE}/api/credits/${id}/schedule/`,
  repayPay:             `${API_BASE}/api/repayments/pay/`,
  repayHistory:         (id) => `${API_BASE}/api/repayments/history/${id}/`,
  repayOverdue:         `${API_BASE}/api/repayments/overdue/`,
  paymentRequests:      `${API_BASE}/api/repayments/requests/`,
  paymentRequestCreate: `${API_BASE}/api/repayments/requests/create/`,
  paymentRequestDetail: (id) => `${API_BASE}/api/repayments/requests/${id}/`,
  paymentRequestValidate: (id) => `${API_BASE}/api/repayments/requests/${id}/validate/`,
  paymentRequestReject:   (id) => `${API_BASE}/api/repayments/requests/${id}/reject/`,
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
  dashStats:     `${API_BASE}/api/dashboard/stats/`,
  notifications:      `${API_BASE}/api/notifications/`,
  notifRead:     (id) => `${API_BASE}/api/notifications/${id}/read/`,
  notifReadAll:  `${API_BASE}/api/notifications/read-all/`,
  notifCount:    `${API_BASE}/api/notifications/unread-count/`,
  conversations:      `${API_BASE}/api/chat/conversations/`,
  chatMessages:  (id) => `${API_BASE}/api/chat/conversations/${id}/messages/`,
  chatAssign:    (id) => `${API_BASE}/api/chat/conversations/${id}/assign/`,
  chatClose:     (id) => `${API_BASE}/api/chat/conversations/${id}/close/`,
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
    const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
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

    const path = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-item').forEach(item => {
      const href = item.getAttribute('href');
      if (href && href.includes(path)) item.classList.add('active');
    });

    this.fillUser();
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

    if (user.role === 'AGENT') {
      document.querySelectorAll('.sidebar-brand-tag').forEach(el => el.textContent = 'ESPACE AGENT');
      document.querySelectorAll('.sidebar-avatar').forEach(el => {
        el.style.background = 'linear-gradient(135deg,#0ea5e9,#38bdf8)';
      });

      const currentPage = window.location.pathname.split('/').pop() || '';
      const nav = document.querySelector('.sidebar-nav');

      // Sur agent-dashboard.html la nav est déjà correcte dans le HTML
      // Sur toutes les autres pages (client ou admin), on injecte la nav agent complète
      if (nav && currentPage !== 'agent-dashboard.html') {
        nav.innerHTML = `
          <div class="nav-section-label">Principal</div>
          <a href="agent-dashboard.html" class="nav-item">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            Tableau de bord
          </a>
          <a href="admin-credits.html" class="nav-item">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            Mes crédits
          </a>
          <a href="repayments.html" class="nav-item">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
            Remboursements
          </a>
          <a href="insurance.html" class="nav-item">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Assurances
          </a>
          <div class="nav-section-label" style="margin-top:8px">Communication</div>
          <a href="notifications.html" class="nav-item">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
            Notifications<span class="notif-count-badge nav-badge" style="display:none">0</span>
          </a>
          <a href="chat.html" class="nav-item">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            Support Chat
          </a>
        `;
        nav.querySelectorAll('.nav-item').forEach(item => {
          const href = item.getAttribute('href');
          if (href && currentPage && href.includes(currentPage)) item.classList.add('active');
        });
      }

      // Corriger les breadcrumbs qui pointent vers client ou admin dashboard
      document.querySelectorAll('.breadcrumb-link').forEach(el => {
        const h = el.getAttribute('href') || '';
        if (h.includes('client-dashboard.html') || h.includes('admin-dashboard.html')) {
          el.href = 'agent-dashboard.html';
          el.textContent = 'Tableau de bord';
        }
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
        group.querySelectorAll('[data-tab-target]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
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
      style: 'currency', currency: 'XOF', minimumFractionDigits: 0,
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

/* ─── INIT GLOBAL ────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  Dropdown.init();
  Tabs.init();

  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) Modal.closeAll();
  });

  // Expose core globals for HTML onclick handlers
  window.Toast   = Toast;
  window.Modal   = Modal;
  window.Auth    = Auth;
  window.Fmt     = Fmt;
  window.Sidebar = Sidebar;

  // Sidebar init (pages without their own JS file, ex: 404.html)
  if (document.getElementById('sidebar')) Sidebar.init();

  // Logout handler
  document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (confirm('Voulez-vous vous déconnecter ?')) Auth.logout();
  });
});