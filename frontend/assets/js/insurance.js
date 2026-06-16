'use strict';

const InsurancePage = {
  async init() {
    if (!Auth.requireLogin()) return;
    Sidebar.init();
    const user = Auth.getUser();
    const isClient = !user || user.role === 'CLIENT';
    if (!isClient) {
      const tabPolices = document.querySelector('[onclick*="polices"]');
      if (tabPolices) tabPolices.style.display = 'none';
      const panelPolices = document.getElementById('tab-polices');
      if (panelPolices) panelPolices.style.display = 'none';
      const panelCatalogue = document.getElementById('tab-catalogue');
      if (panelCatalogue) panelCatalogue.style.display = '';
      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
        if (b.getAttribute('onclick')?.includes('catalogue')) b.classList.add('active');
      });
    }
    await this.loadProducts();
    if (isClient) await this.loadPolicies();
  },

  async loadProducts() {
    try {
      const data = await Http.get(API.insuranceProducts);
      const products = data.results || data || [];
      this.renderProducts(products);
    } catch {
      this.renderProducts([]);
    }
  },

  renderProducts(products) {
    const el = document.getElementById('productsList');
    if (!el) return;
    const user = Auth.getUser();
    const isClient = !user || user.role === 'CLIENT';
    if (!products.length) {
      el.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px 24px">
        <div style="font-size:3rem;margin-bottom:16px">🛡</div>
        <p style="color:var(--t-muted)">Aucun produit d'assurance disponible pour le moment.</p>
      </div>`;
      return;
    }
    el.innerHTML = products.map(p => `
      <div class="insurance-card animate-fadeIn">
        <div class="insurance-card-header">
          <div style="font-size:.8rem;opacity:.8;margin-bottom:6px">${p.type_produit === 'VIE' ? '🛡 Assurance Vie' : '🏥 Décès & Invalidité'}</div>
          <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:8px">${p.nom}</h3>
          <div class="insurance-price">${Fmt.money(p.prime_mensuelle)} <span>/mois</span></div>
        </div>
        <div class="insurance-card-body">
          <p class="text-sm text-secondary" style="margin-bottom:16px">${p.description}</p>
          <div class="insurance-feature">Couverture max : <strong>${Fmt.money(p.couverture_max)}</strong></div>
          <div class="insurance-feature">Souscription immédiate en ligne</div>
          <div class="insurance-feature">Résiliation possible à tout moment</div>
          ${isClient ? `<div style="margin-top:20px">
            <button class="btn btn-primary w-full" onclick="openSubscribeModal(${p.id}, '${p.nom.replace(/'/g, "\\'")}')">
              Souscrire
            </button>
          </div>` : ''}
        </div>
      </div>
    `).join('');
  },

  async loadPolicies() {
    try {
      const data = await Http.get(API.insurancePolicies);
      const policies = data.results || data || [];
      this.renderPolicies(policies);
    } catch { }
  },

  renderPolicies(policies) {
    const el = document.getElementById('policiesList');
    if (!el) return;
    if (!policies.length) {
      el.innerHTML = `<div class="card" style="text-align:center;padding:48px 24px">
        <div style="font-size:3rem;margin-bottom:16px">🛡</div>
        <p style="color:var(--t-muted);margin-bottom:16px">Vous n'avez aucune police active.</p>
        <button class="btn btn-primary" onclick="showInsTab('catalogue', document.querySelectorAll('.tab-btn')[1])">Découvrir nos produits</button>
      </div>`;
      return;
    }
    el.innerHTML = policies.map(p => `
      <div class="card card-sm flex items-center gap-4 mb-3">
        <div class="stat-icon stat-icon-primary">🛡</div>
        <div class="flex-1">
          <div class="font-semibold">${p.produit_details?.nom || 'Police #' + p.id}</div>
          <div class="text-sm text-muted">Du ${Fmt.date(p.date_debut)} au ${Fmt.date(p.date_fin)}</div>
        </div>
        ${Fmt.statusBadge(p.statut)}
      </div>
    `).join('');
  },
};

/* ── Souscription (modal inline dans insurance.html) ──────── */
let subscribeProductId = null;

function showInsTab(tab, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-polices').style.display   = tab === 'polices'   ? '' : 'none';
  document.getElementById('tab-catalogue').style.display = tab === 'catalogue' ? '' : 'none';
}

function openSubscribeModal(productId, productName) {
  subscribeProductId = productId;
  document.getElementById('subscribeProductName').textContent = productName;
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('subscribeStartDate').value = today;
  Modal.open('subscribeModal');
}

async function confirmSubscribe() {
  const start = document.getElementById('subscribeStartDate').value;
  const end   = document.getElementById('subscribeEndDate').value;
  if (!start || !end) { Toast.show('Dates requises', 'error'); return; }
  try {
    await Http.post(API.insuranceSubscribe, { produit: subscribeProductId, date_debut: start, date_fin: end });
    Modal.close('subscribeModal');
    Toast.show('Souscription réussie !', 'success');
    InsurancePage.init();
  } catch (err) {
    Toast.show('Erreur', 'error', err.message);
  }
}

window.InsurancePage      = InsurancePage;
window.showInsTab         = showInsTab;
window.openSubscribeModal = openSubscribeModal;
window.confirmSubscribe   = confirmSubscribe;

document.addEventListener('DOMContentLoaded', () => InsurancePage.init());