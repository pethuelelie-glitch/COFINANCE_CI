'use strict';

let allAgents = [];

async function initAgents() {
  if (!Auth.requireLogin(['ADMIN'])) return;
  Sidebar.init();
  await loadAgents();
}

async function loadAgents() {
  try {
    const data = await Http.get(API.agentManage);
    allAgents = data.results || data || [];
  } catch {
    allAgents = [];
  }
  setText('stat-agents-total',    allAgents.length);
  setText('stat-agents-active',   allAgents.filter(a => a.is_active).length);
  setText('stat-agents-inactive', allAgents.filter(a => !a.is_active).length);
  renderAgents(allAgents);
}

function renderAgents(agents) {
  const tb = document.getElementById('agentsTableBody');
  if (!tb) return;
  if (!agents.length) {
    tb.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">👤</div><div class="empty-state-title">Aucun agent</div><div class="empty-state-desc">Cliquez sur "Créer un agent" pour en ajouter un.</div></div></td></tr>`;
    return;
  }
  tb.innerHTML = agents.map(a => {
    const name = `${a.first_name} ${a.last_name}`;
    return `
      <tr>
        <td>
          <div class="table-user">
            <div class="table-avatar" style="background:linear-gradient(135deg,var(--c-danger),#f87171)">${Fmt.initials(name)}</div>
            <div><div class="table-user-name">${name}</div></div>
          </div>
        </td>
        <td class="table-user-email">${a.email}</td>
        <td>${a.phone || '<span style="color:var(--t-light)">—</span>'}</td>
        <td>${a.ville || '—'}</td>
        <td style="font-size:.8rem;color:var(--t-muted)">${Fmt.date(a.created_at)}</td>
        <td>
          <span class="badge ${a.is_active ? 'badge-success' : 'badge-danger'}">
            ${a.is_active ? 'Actif' : 'Suspendu'}
          </span>
        </td>
        <td>
          <div class="table-actions">
            <button class="btn btn-secondary btn-sm" onclick="viewAgent(${a.id})">Voir</button>
            <button class="btn btn-${a.is_active ? 'danger' : 'success'} btn-sm"
              onclick="toggleAgent(${a.id}, ${!a.is_active})">
              ${a.is_active ? 'Suspendre' : 'Activer'}
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterAgents() {
  const q      = document.getElementById('agentSearch').value.toLowerCase();
  const status = document.getElementById('statusFilter').value;
  renderAgents(allAgents.filter(a => {
    const text = `${a.first_name} ${a.last_name} ${a.email}`.toLowerCase();
    const matchQ = !q || text.includes(q);
    const matchS = !status
      || (status === 'active'   &&  a.is_active)
      || (status === 'inactive' && !a.is_active);
    return matchQ && matchS;
  }));
}

async function toggleAgent(id, newStatus) {
  try {
    await Http.patch(API.agentDetail(id), { is_active: newStatus });
    Toast.show(newStatus ? 'Agent activé' : 'Agent suspendu', 'success');
    await loadAgents();
  } catch (err) {
    Toast.show('Erreur', 'error', err.message);
  }
}

function viewAgent(id) {
  const a = allAgents.find(x => x.id === id);
  if (!a) return;
  const name = `${a.first_name} ${a.last_name}`;
  document.getElementById('agentDetailTitle').textContent = name;
  document.getElementById('agentDetailBody').innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px">
      <div class="profile-avatar-lg" style="background:linear-gradient(135deg,var(--c-danger),#f87171);color:#fff;width:56px;height:56px;font-size:1.2rem;border:none">
        ${Fmt.initials(name)}
      </div>
      <div>
        <div style="font-weight:700;font-size:1.05rem;color:var(--t-primary)">${name}</div>
        <div style="font-size:.82rem;color:var(--t-muted)">${a.email}</div>
        <span class="badge ${a.is_active ? 'badge-success' : 'badge-danger'}" style="margin-top:6px">
          ${a.is_active ? 'Actif' : 'Suspendu'}
        </span>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div>
        <div style="font-size:.75rem;color:var(--t-muted);margin-bottom:4px">Téléphone</div>
        <div style="font-weight:500">${a.phone || '—'}</div>
      </div>
      <div>
        <div style="font-size:.75rem;color:var(--t-muted);margin-bottom:4px">Ville</div>
        <div style="font-weight:500">${a.ville || '—'}</div>
      </div>
      <div>
        <div style="font-size:.75rem;color:var(--t-muted);margin-bottom:4px">Région</div>
        <div style="font-weight:500">${a.region ? `<span class="badge badge-muted">${a.region}</span>` : '—'}</div>
      </div>
      <div>
        <div style="font-size:.75rem;color:var(--t-muted);margin-bottom:4px">Inscrit le</div>
        <div style="font-weight:500">${Fmt.date(a.created_at)}</div>
      </div>
      ${a.adresse ? `<div style="grid-column:1/-1"><div style="font-size:.75rem;color:var(--t-muted);margin-bottom:4px">Adresse</div><div style="font-weight:500">${a.adresse}</div></div>` : ''}
    </div>
    <div style="margin-top:20px;padding:14px 16px;background:var(--bg-hover);border-radius:var(--r-md);border:1px solid var(--border)">
      <div style="font-size:.75rem;font-weight:700;color:var(--t-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Action rapide</div>
      <button class="btn btn-${a.is_active ? 'danger' : 'success'} btn-sm"
        onclick="toggleAgent(${a.id}, ${!a.is_active}); Modal.close('agentDetailModal')">
        ${a.is_active ? '⊘ Suspendre cet agent' : '✓ Activer cet agent'}
      </button>
    </div>
  `;
  Modal.open('agentDetailModal');
}

async function createAgent(e) {
  e.preventDefault();
  const errEl = document.getElementById('createAgentError');
  errEl.style.display = 'none';

  const firstName = document.getElementById('newAgentFirstName').value.trim();
  const lastName  = document.getElementById('newAgentLastName').value.trim();
  const email     = document.getElementById('newAgentEmail').value.trim();
  const phone     = document.getElementById('newAgentPhone').value.trim();
  const password  = document.getElementById('newAgentPassword').value;
  const password2 = document.getElementById('newAgentPassword2').value;

  if (password !== password2) {
    errEl.textContent = 'Les mots de passe ne correspondent pas.';
    errEl.style.display = 'block';
    return;
  }

  const btn = document.getElementById('createAgentBtn');
  const origHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span style="display:inline-block;width:13px;height:13px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;vertical-align:middle;margin-right:6px"></span>Création…';

  try {
    await Http.post(API.agentManage, {
      email, first_name: firstName, last_name: lastName, phone, password,
    });
    Modal.close('createAgentModal');
    document.getElementById('createAgentForm').reset();
    Toast.show('Agent créé avec succès', 'success');
    await loadAgents();
  } catch (err) {
    errEl.textContent = err.message || 'Erreur lors de la création.';
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.innerHTML = origHTML;
  }
}

window.filterAgents  = filterAgents;
window.toggleAgent   = toggleAgent;
window.viewAgent     = viewAgent;
window.createAgent   = createAgent;

document.addEventListener('DOMContentLoaded', () => initAgents());