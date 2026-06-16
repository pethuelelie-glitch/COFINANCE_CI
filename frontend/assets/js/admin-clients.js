'use strict';

let allClients = [];

const AdminClients = {};

AdminClients.init = async function() {
  if (!Auth.requireLogin(['ADMIN', 'AGENT'])) return;
  Sidebar.init();
  try {
    const data = await Http.get(API.clients);
    allClients = data.results || data || [];
    document.getElementById('clientsCount').textContent = `${allClients.length} client${allClients.length > 1 ? 's' : ''}`;
    renderClients(allClients);
  } catch {
    allClients = [];
    document.getElementById('clientsCount').textContent = '0 clients';
    renderClients([]);
  }
};

function renderClients(clients) {
  const tb = document.getElementById('clientsTableBody');
  if (!tb) return;
  const isAdmin = Auth.getUser()?.role === 'ADMIN';
  tb.innerHTML = clients.length ? clients.map(c => {
    const initials = Fmt.initials(`${c.first_name} ${c.last_name}`);
    const active   = c.is_active !== false;
    return `
      <tr>
        <td>
          <div class="table-user">
            <div class="table-avatar">${initials}</div>
            <div><div class="table-user-name">${c.first_name} ${c.last_name}</div></div>
          </div>
        </td>
        <td class="table-user-email">${c.email}</td>
        <td>${c.phone || '<span style="color:var(--t-light)">—</span>'}</td>
        <td>${c.ville || '—'}</td>
        <td>${c.region ? `<span class="badge badge-muted">${c.region}</span>` : '—'}</td>
        <td style="font-size:.8rem;color:var(--t-muted)">${Fmt.date(c.created_at)}</td>
        <td>
          <span class="badge ${active ? 'badge-success' : 'badge-danger'}">${active ? 'Actif' : 'Suspendu'}</span>
        </td>
        <td>
          <div class="table-actions">
            <button class="btn btn-secondary btn-sm" onclick="viewClient(${c.id})">Voir</button>
            ${isAdmin ? `<button class="btn btn-sm ${active ? 'btn-warning' : 'btn-primary'}" onclick="toggleClient(${c.id}, ${active})">${active ? 'Suspendre' : 'Activer'}</button>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('') : '<tr><td colspan="8"><div class="empty-state"><div class="empty-state-icon">👥</div><div class="empty-state-title">Aucun client</div><div class="empty-state-desc">Les clients apparaîtront ici après inscription</div></div></td></tr>';
}

function filterClients() {
  const q   = document.getElementById('clientSearch').value.toLowerCase();
  const reg = document.getElementById('regionFilter').value;
  renderClients(allClients.filter(c => {
    const text = `${c.first_name} ${c.last_name} ${c.email} ${c.ville || ''} ${c.region || ''}`.toLowerCase();
    const matchQ   = !q   || text.includes(q);
    const matchReg = !reg || c.region === reg;
    return matchQ && matchReg;
  }));
}

function viewClient(id) {
  const c = allClients.find(x => x.id === id);
  if (!c) return;
  document.getElementById('clientDetailTitle').textContent = `${c.first_name} ${c.last_name}`;
  document.getElementById('clientDetailBody').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div><div style="font-size:.75rem;color:var(--t-muted);margin-bottom:4px">Email</div><div style="font-weight:500">${c.email}</div></div>
      <div><div style="font-size:.75rem;color:var(--t-muted);margin-bottom:4px">Téléphone</div><div style="font-weight:500">${c.phone || '—'}</div></div>
      <div><div style="font-size:.75rem;color:var(--t-muted);margin-bottom:4px">Ville</div><div style="font-weight:500">${c.ville || '—'}</div></div>
      <div><div style="font-size:.75rem;color:var(--t-muted);margin-bottom:4px">Région</div><div style="font-weight:500">${c.region || '—'}</div></div>
      <div><div style="font-size:.75rem;color:var(--t-muted);margin-bottom:4px">Date de naissance</div><div style="font-weight:500">${Fmt.date(c.date_naissance) || '—'}</div></div>
      <div><div style="font-size:.75rem;color:var(--t-muted);margin-bottom:4px">Inscrit le</div><div style="font-weight:500">${Fmt.date(c.created_at)}</div></div>
      ${c.adresse ? `<div style="grid-column:1/-1"><div style="font-size:.75rem;color:var(--t-muted);margin-bottom:4px">Adresse</div><div style="font-weight:500">${c.adresse}</div></div>` : ''}
    </div>
  `;
  Modal.open('clientDetailModal');
}

async function toggleClient(id, currentActive) {
  const action = currentActive ? 'suspendre' : 'activer';
  if (!confirm(`Voulez-vous ${action} ce client ?`)) return;
  try {
    const res = await Http.patch(API.clientDetail(id), { is_active: !currentActive });
    const idx = allClients.findIndex(c => c.id === id);
    if (idx !== -1) { allClients[idx] = { ...allClients[idx], ...res, is_active: res.is_active }; }
    renderClients(allClients);
    Toast.show(currentActive ? 'Client suspendu' : 'Client activé', 'success');
  } catch (err) {
    Toast.show('Erreur', 'error', err.message);
  }
}

window.AdminClients   = AdminClients;
window.filterClients  = filterClients;
window.viewClient     = viewClient;
window.toggleClient   = toggleClient;

document.addEventListener('DOMContentLoaded', () => AdminClients.init());