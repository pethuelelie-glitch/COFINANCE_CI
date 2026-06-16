'use strict';

let allEcheances = [];

const RepaymentsPage = {};

RepaymentsPage.init = async function() {
  if (!Auth.requireLogin()) return;
  Sidebar.init();
  try {
    const user = Auth.getUser();
    const data = await Http.get(API.repayHistory(user.id));
    allEcheances = data.results || data || [];
    const paid    = allEcheances.filter(e => e.statut === 'PAYEE').length;
    const late    = allEcheances.filter(e => e.statut === 'EN_RETARD').length;
    const pending = allEcheances.length - paid - late;
    document.getElementById('cnt-paid').textContent    = paid;
    document.getElementById('cnt-pending').textContent = pending;
    document.getElementById('cnt-late').textContent    = late;
    renderEcheances(allEcheances);
  } catch {
    const tb = document.getElementById('repaymentsTableBody');
    if (tb) tb.innerHTML = '<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-title">Aucune donnée</div></div></td></tr>';
  }
};

function renderEcheances(items) {
  const tb = document.getElementById('repaymentsTableBody');
  if (!tb) return;
  tb.innerHTML = items.length ? items.map(e => `
    <tr class="${e.statut === 'EN_RETARD' ? 'row-warning' : e.statut === 'PAYEE' ? 'row-success' : ''}">
      <td><span style="font-size:.8rem;color:var(--t-muted)">Crédit #${e.credit || e.credit_id}</span></td>
      <td><div class="echeance-num ${e.statut === 'PAYEE' ? 'paid' : e.statut === 'EN_RETARD' ? 'late' : ''}">${e.numero_echeance}</div></td>
      <td>${Fmt.date(e.date_echeance)}</td>
      <td class="amount">${Fmt.money(e.montant_du)} FCFA</td>
      <td>${Fmt.statusBadge(e.statut)}</td>
    </tr>
  `).join('') : '<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-title">Aucune échéance</div></div></td></tr>';
}

function filterEcheances(statut, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderEcheances(statut === 'all' ? allEcheances : allEcheances.filter(e => e.statut === statut));
}

window.filterEcheances = filterEcheances;
window.RepaymentsPage  = RepaymentsPage;

document.addEventListener('DOMContentLoaded', () => RepaymentsPage.init());