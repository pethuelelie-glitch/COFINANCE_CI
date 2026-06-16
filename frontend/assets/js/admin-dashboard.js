'use strict';

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

document.addEventListener('DOMContentLoaded', () => AdminDashboard.init());