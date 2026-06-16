'use strict';

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
document.addEventListener('DOMContentLoaded', () => AgentDashboard.init());