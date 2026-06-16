'use strict';

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

      const byStatus = {};
      credits.forEach(c => { byStatus[c.statut] = (byStatus[c.statut] || 0) + 1; });
      ['DECAISSEE','APPROUVEE','EN_ANALYSE','SOUMISE','REJETEE'].forEach(s => setText('lbl-'+s, byStatus[s]||0));
      this.initCharts(byStatus);

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

document.addEventListener('DOMContentLoaded', () => ClientDashboard.init());