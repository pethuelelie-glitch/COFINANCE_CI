'use strict';

const AdminCreditsKanban = {
  credits: [],
  pendingId: null,

  async init() {
    if (!Auth.requireLogin(['ADMIN', 'AGENT'])) return;
    Sidebar.init();
    await this.load();
  },

  async load() {
    try {
      const data = await Http.get(API.credits);
      this.credits = data.results || data || [];
    } catch {
      this.credits = [];
    }
    this.buildBoard();
    this.render();
    this.initDragDrop();
  },

  reload() { this.load(); },

  buildBoard() {
    const board = document.getElementById('kanbanBoard');
    if (!board) return;
    const COLS = [
      { key:'SOUMISE',    label:'Soumise',    cls:'stat-icon-warning' },
      { key:'EN_ANALYSE', label:'En analyse', cls:'stat-icon-sky' },
      { key:'APPROUVEE',  label:'Approuvée',  cls:'stat-icon-success' },
      { key:'DECAISSEE',  label:'Décaissée',  cls:'stat-icon-primary' },
      { key:'REJETEE',    label:'Rejetée',    cls:'stat-icon-danger' },
    ];
    board.innerHTML = COLS.map(c => `
      <div class="kanban-col">
        <div class="kanban-col-header">
          <span class="kanban-col-title">${c.label}</span>
          <span class="badge" id="count-${c.key}">0</span>
        </div>
        <div class="kanban-col-body" id="col-${c.key}" data-statut="${c.key}"></div>
      </div>
    `).join('');
  },

  render() {
    const cols = ['SOUMISE','EN_ANALYSE','APPROUVEE','DECAISSEE','REJETEE'];
    cols.forEach(statut => {
      const col = document.getElementById(`col-${statut}`);
      if (!col) return;
      const items = this.credits.filter(c => c.statut === statut);
      col.innerHTML = items.length ? items.map(c => `
        <div class="kanban-card" draggable="true" data-id="${c.id}" data-statut="${c.statut}" onclick="AdminCreditsKanban.openCard(${c.id})">
          <div class="kanban-card-title">Crédit #${c.id} — ${c.client_name || 'Client'}</div>
          <div style="font-size:.8rem;color:var(--t-muted);margin:6px 0">${c.motif || '—'}</div>
          <div class="kanban-card-meta">
            <span style="font-weight:700;color:var(--c-primary)">${Fmt.money(c.montant_demande)}</span>
            <span style="font-size:.75rem;color:var(--t-muted)">${Fmt.date(c.date_soumission)}</span>
          </div>
          ${c.agent_name ? `<div style="font-size:.75rem;color:var(--t-muted);margin-top:8px">👤 ${c.agent_name}</div>` : ''}
        </div>
      `).join('') : `<div style="text-align:center;padding:24px;color:var(--t-light);font-size:.82rem">Aucune demande</div>`;

      const countEl = document.getElementById(`count-${statut}`);
      if (countEl) countEl.textContent = items.length;
    });
  },

  openCard(id) {
    const c = this.credits.find(x => x.id == id);
    if (!c) return;
    this.pendingId = id;
    const desc = document.getElementById('statusChangeDesc');
    if (desc) desc.textContent = `Crédit #${id} — ${c.client_name || 'Client'} — ${Fmt.money(c.montant_demande)} FCFA`;
    const sel = document.getElementById('newStatusSelect');
    if (sel) sel.value = c.statut;
    Http.get(API.agents).then(data => {
      const agents = data?.results || data || [];
      const agSel = document.getElementById('agentSelectKanban');
      if (agSel) {
        agSel.innerHTML = '<option value="">— Sans agent —</option>' +
          agents.map(a => `<option value="${a.id}" ${c.agent == a.id ? 'selected' : ''}>${a.first_name} ${a.last_name}</option>`).join('');
      }
    }).catch(() => {});
    Modal.open('statusChangeModal');
  },

  initDragDrop() {
    document.querySelectorAll('.kanban-card').forEach(card => {
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', card.dataset.id);
        card.classList.add('dragging');
      });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
    });

    document.querySelectorAll('.kanban-col-body').forEach(col => {
      col.addEventListener('dragover',  (e) => { e.preventDefault(); col.classList.add('drag-over'); });
      col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
      col.addEventListener('drop', async (e) => {
        e.preventDefault();
        col.classList.remove('drag-over');
        const id = e.dataTransfer.getData('text/plain');
        const newStatus = col.dataset.statut;
        try {
          await Http.patch(API.creditStatus(id), { statut: newStatus });
          const credit = this.credits.find(c => c.id == id);
          if (credit) { credit.statut = newStatus; this.render(); this.initDragDrop(); }
          Toast.show('Statut mis à jour', 'success');
        } catch (err) {
          Toast.show('Erreur', 'error', err.message);
        }
      });
    });
  },
};

async function confirmStatusChange() {
  const id      = AdminCreditsKanban.pendingId;
  const statut  = document.getElementById('newStatusSelect')?.value;
  const agentId = document.getElementById('agentSelectKanban')?.value;
  if (!id || !statut) return;
  try {
    const payload = { statut };
    if (agentId) payload.agent = parseInt(agentId);
    await Http.patch(API.creditStatus(id), payload);
    const credit = AdminCreditsKanban.credits.find(c => c.id == id);
    if (credit) credit.statut = statut;
    Modal.close('statusChangeModal');
    AdminCreditsKanban.render();
    AdminCreditsKanban.initDragDrop();
    Toast.show('Statut mis à jour', 'success');
  } catch (err) {
    Toast.show('Erreur', 'error', err.message);
  }
}

window.AdminCreditsKanban  = AdminCreditsKanban;
window.confirmStatusChange = confirmStatusChange;

document.addEventListener('DOMContentLoaded', () => AdminCreditsKanban.init());