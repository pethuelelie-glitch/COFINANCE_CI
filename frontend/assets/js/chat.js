'use strict';

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

    const empty  = document.getElementById('chatEmptyState');
    const active = document.getElementById('chatActive');
    if (empty)  empty.style.display = 'none';
    if (active) { active.style.display = 'flex'; active.style.flexDirection = 'column'; active.style.overflow = 'hidden'; active.style.flex = '1'; }

    document.querySelectorAll('.conv-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.conv-item').forEach(el => {
      if (el.getAttribute('onclick')?.includes(`(${id})`)) el.classList.add('active');
    });

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
          const empty = el.querySelector('.msg-empty');
          if (empty) empty.remove();
          el.insertAdjacentHTML('beforeend', this.buildBubble(data.message));
          el.scrollTop = el.scrollHeight;
        }
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

window.ChatPage = ChatPage;
document.addEventListener('DOMContentLoaded', () => ChatPage.init());