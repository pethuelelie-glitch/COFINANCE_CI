'use strict';

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

async function showSchedule(creditId) {
  Modal.open('scheduleModal');
  document.getElementById('scheduleModalTitle').textContent = `Échéancier — Crédit #${creditId}`;
  const body = document.getElementById('scheduleModalBody');
  body.innerHTML = '<div class="spinner" style="margin:32px auto"></div>';
  try {
    const data = await Http.get(API.creditSchedule(creditId));
    const items = Array.isArray(data) ? data : (data.results || []);
    body.innerHTML = items.length ? `
      <div class="table-wrapper">
        <table class="table">
          <thead><tr><th>#</th><th>Date échéance</th><th>Montant dû</th><th>Statut</th></tr></thead>
          <tbody>${items.map(e => `
            <tr class="${e.statut === 'EN_RETARD' ? 'row-warning' : ''}">
              <td><div class="echeance-num ${e.statut === 'PAYEE' ? 'paid' : e.statut === 'EN_RETARD' ? 'late' : ''}">${e.numero_echeance}</div></td>
              <td>${Fmt.date(e.date_echeance)}</td>
              <td class="amount">${Fmt.money(e.montant_du)}</td>
              <td>${Fmt.statusBadge(e.statut)}</td>
            </tr>
          `).join('')}</tbody>
        </table>
      </div>
    ` : '<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-title">Pas encore d\'échéancier</div></div>';
  } catch {
    body.innerHTML = '<p style="text-align:center;color:var(--c-danger);padding:24px">Erreur de chargement</p>';
  }
}
window.showSchedule = showSchedule;

window.CreditsPage = CreditsPage;
document.addEventListener('DOMContentLoaded', () => {
  CreditsPage.init();
  document.getElementById('creditsSearch')?.addEventListener('input', function() {
    const q = this.value.toLowerCase();
    document.querySelectorAll('#creditsTableBody tr').forEach(r => { r.style.display = r.textContent.toLowerCase().includes(q) ? '' : 'none'; });
  });
  document.getElementById('statusFilter')?.addEventListener('change', function() {
    const v = this.value;
    document.querySelectorAll('#creditsTableBody tr').forEach(r => { r.style.display = (!v || r.textContent.includes(v)) ? '' : 'none'; });
  });
});