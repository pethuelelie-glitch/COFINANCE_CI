'use strict';

let allConversations = [];
let assignConvId = null;

async function initSupport() {
  if (!Auth.requireLogin(['ADMIN', 'AGENT'])) return;
  Sidebar.init();
  const isAdmin = Auth.getUser()?.role === 'ADMIN';
  const tasks = [loadConversations()];
  if (isAdmin) tasks.push(loadAgents());
  await Promise.all(tasks);
}

async function loadAgents() {
  try {
    const agents = await Http.get(API.agents);
    const list = agents.results || agents || [];
    const sel = document.getElementById('agentSelect');
    if (sel) {
      sel.innerHTML = list.length
        ? list.map(a => `<option value="${a.id}">${a.first_name} ${a.last_name} (${a.email})</option>`).join('')
        : '<option value="">Aucun agent disponible</option>';
    }
  } catch { /* keep placeholder */ }
}

async function loadConversations() {
  try {
    const data = await Http.get(API.conversations);
    allConversations = data.results || data || [];
  } catch {
    allConversations = [];
  }
  document.getElementById('sc-open').textContent       = allConversations.filter(c => c.statut === 'OUVERTE').length;
  document.getElementById('sc-unassigned').textContent = allConversations.filter(c => !c.agent_name && !c.agent).length;
  document.getElementById('sc-closed').textContent     = allConversations.filter(c => c.statut === 'FERMEE').length;
  renderConversations(allConversations);
}

function renderConversations(convs) {
  const el = document.getElementById('supportConvList');
  if (!el) return;
  el.innerHTML = convs.length ? convs.map(c => `
    <div class="card mb-3" style="border-left:3px solid ${c.statut === 'OUVERTE' ? 'var(--c-primary)' : c.statut === 'EN_COURS' ? 'var(--c-warning)' : 'var(--border)'}">
      <div class="card-body" style="display:flex;align-items:center;gap:14px;padding:14px 18px">
        <div class="conv-avatar" style="flex-shrink:0">${Fmt.initials(c.client_name || 'C')}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span style="font-weight:600;color:var(--t-primary)">${c.client_name || 'Client #' + c.id}</span>
            ${Fmt.statusBadge(c.statut)}
          </div>
          <div style="font-size:.82rem;color:var(--t-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.last_message || 'Aucun message'}</div>
          <div style="font-size:.75rem;color:var(--t-light);margin-top:3px">${Fmt.relativeTime(c.updated_at)}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;flex-shrink:0">
          ${c.agent_name || c.agent ? `<div style="font-size:.78rem;color:var(--t-muted)">👤 ${c.agent_name || c.agent?.email}</div>` : `<span class="badge badge-warning">Non assignée</span>`}
          <div style="display:flex;gap:6px">
            ${!c.agent_name && !c.agent && Auth.getUser()?.role === 'ADMIN' ? `<button class="btn btn-primary btn-sm" onclick="openAssign(${c.id})">Assigner</button>` : ''}
            ${c.statut !== 'FERMEE' ? `<button class="btn btn-ghost btn-sm" onclick="closeConv(${c.id})">Fermer</button>` : ''}
            <button class="btn btn-outline btn-sm" onclick="viewConv(${c.id})">Voir →</button>
          </div>
        </div>
      </div>
    </div>
  `).join('') : `
    <div class="empty-state">
      <div class="empty-state-icon">💬</div>
      <div class="empty-state-title">Aucune conversation</div>
    </div>
  `;
}

function filterConvs(statut, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderConversations(statut === 'all' ? allConversations : allConversations.filter(c => c.statut === statut));
}

function openAssign(convId) {
  assignConvId = convId;
  Modal.open('assignModal');
}

async function confirmAssign() {
  const agentId = document.getElementById('agentSelect').value;
  try {
    await Http.patch(API.chatAssign(assignConvId), { agent_id: parseInt(agentId) });
    Modal.close('assignModal');
    Toast.show('Agent assigné', 'success');
    await loadConversations();
  } catch (err) {
    Toast.show('Erreur', 'error', err.message);
  }
}

async function closeConv(convId) {
  if (!confirm('Fermer cette conversation ?')) return;
  try {
    await Http.patch(API.chatClose(convId), {});
    Toast.show('Conversation fermée', 'success');
    await loadConversations();
  } catch (err) {
    Toast.show('Erreur', 'error', err.message);
  }
}

function viewConv(convId) {
  window.open(`chat.html?conv=${convId}`, '_blank');
}

window.filterConvs   = filterConvs;
window.openAssign    = openAssign;
window.confirmAssign = confirmAssign;
window.closeConv     = closeConv;
window.viewConv      = viewConv;

document.addEventListener('DOMContentLoaded', () => initSupport());