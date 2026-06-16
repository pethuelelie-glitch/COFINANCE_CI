'use strict';

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

function filterNotifs(type, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.notif-item').forEach(el => {
    if (type === 'all') { el.style.display = ''; return; }
    const isUnread = el.classList.contains('unread');
    el.style.display = (type === 'unread' ? isUnread : !isUnread) ? '' : 'none';
  });
}

async function markAllRead() {
  try {
    await Http.patch(API.notifReadAll, {});
    await NotificationsPage.loadNotifications();
    Toast.show('Toutes les notifications sont lues', 'success');
  } catch (err) {
    Toast.show('Erreur', 'error', err.message);
  }
}

window.NotificationsPage = NotificationsPage;
window.filterNotifs = filterNotifs;
window.markAllRead  = markAllRead;
document.addEventListener('DOMContentLoaded', () => NotificationsPage.init());