'use strict';

let allProducts = [];
let allPolicies = [];
let deleteProductId = null;

async function initInsurances() {
  if (!Auth.requireLogin(['ADMIN'])) return;
  Sidebar.init();
  await Promise.all([loadAdminProducts(), loadAdminPolicies()]);
}

async function loadAdminProducts() {
  try {
    const data = await Http.get(API.insuranceProducts);
    allProducts = data.results || data || [];
    renderAdminProducts();
    document.getElementById('statProducts').textContent = allProducts.length;
  } catch {
    document.getElementById('productGrid').innerHTML = '<p style="color:var(--t-muted);padding:24px">Erreur de chargement.</p>';
  }
}

async function loadAdminPolicies() {
  try {
    const data = await Http.get(API.insuranceAll);
    allPolicies = data.results || data || [];
    renderAdminPolicies(allPolicies);
    document.getElementById('statActive').textContent    = allPolicies.filter(p => p.statut === 'ACTIVE').length;
    document.getElementById('statExpired').textContent   = allPolicies.filter(p => p.statut === 'EXPIREE').length;
    document.getElementById('statCancelled').textContent = allPolicies.filter(p => p.statut === 'RESILIEE').length;
  } catch {
    document.getElementById('policiesTableBody').innerHTML =
      '<tr><td colspan="6" style="text-align:center;color:var(--t-muted);padding:32px">Erreur de chargement.</td></tr>';
  }
}

function renderAdminProducts() {
  const grid = document.getElementById('productGrid');
  if (!grid) return;
  if (!allProducts.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:48px 24px">
      <div style="font-size:3rem;margin-bottom:16px">🛡</div>
      <p style="color:var(--t-muted);margin-bottom:20px">Aucun produit d'assurance. Commencez par en créer un.</p>
      <button class="btn btn-primary" onclick="openProductModal()">Ajouter un produit</button>
    </div>`;
    return;
  }
  grid.innerHTML = allProducts.map(p => `
    <div class="insurance-card animate-fadeIn">
      <div class="insurance-card-header">
        <div style="font-size:.8rem;opacity:.8;margin-bottom:6px">${p.type_produit === 'VIE' ? '🛡 Assurance Vie' : '🏥 Décès & Invalidité'}</div>
        <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:8px">${p.nom}</h3>
        <div class="insurance-price">${Fmt.money(p.prime_mensuelle)} <span>/mois</span></div>
      </div>
      <div class="insurance-card-body">
        <p class="text-sm text-secondary" style="margin-bottom:12px">${p.description}</p>
        <div class="insurance-feature">Couverture max : <strong>${Fmt.money(p.couverture_max)}</strong></div>
        <div style="margin-top:20px;display:flex;gap:8px">
          <button class="btn btn-ghost btn-sm" style="flex:1" onclick="editProduct(${p.id})">Modifier</button>
          <button class="btn btn-sm" style="flex:1;background:var(--c-danger);color:#fff;border:none" onclick="openDeleteModal(${p.id}, '${p.nom.replace(/'/g, "\\'")}')">Supprimer</button>
        </div>
      </div>
    </div>
  `).join('');
}

function renderAdminPolicies(policies) {
  const tbody = document.getElementById('policiesTableBody');
  if (!tbody) return;
  if (!policies.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--t-muted);padding:32px">Aucune police trouvée.</td></tr>';
    return;
  }
  tbody.innerHTML = policies.map(p => {
    const client  = p.client_name       || (p.client  ? `Client #${p.client}`  : '—');
    const produit = p.produit_details?.nom || (p.produit ? `Produit #${p.produit}` : '—');
    return `<tr>
      <td>${client}</td>
      <td>${produit}</td>
      <td>${Fmt.date(p.date_debut)}</td>
      <td>${Fmt.date(p.date_fin)}</td>
      <td>${Fmt.statusBadge(p.statut)}</td>
      <td>${p.statut === 'ACTIVE'
        ? `<button class="btn btn-sm" style="background:var(--c-danger);color:#fff;border:none" onclick="resilierPolicy(${p.id})">Résilier</button>`
        : '—'}</td>
    </tr>`;
  }).join('');
}

function filterPolicies() {
  const search = document.getElementById('policySearch').value.toLowerCase();
  const status = document.getElementById('policyStatusFilter').value;
  const filtered = allPolicies.filter(p => {
    const client  = (p.client_name || '').toLowerCase();
    const produit = (p.produit_details?.nom || '').toLowerCase();
    const matchSearch = !search || client.includes(search) || produit.includes(search);
    const matchStatus = !status || p.statut === status;
    return matchSearch && matchStatus;
  });
  renderAdminPolicies(filtered);
}

function showInsuranceTab(tab, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-products').style.display = tab === 'products' ? '' : 'none';
  document.getElementById('tab-policies').style.display = tab === 'policies' ? '' : 'none';
}

function openProductModal(product) {
  document.getElementById('productId').value          = product ? product.id : '';
  document.getElementById('productNom').value         = product ? product.nom : '';
  document.getElementById('productType').value        = product ? product.type_produit : 'VIE';
  document.getElementById('productPrime').value       = product ? product.prime_mensuelle : '';
  document.getElementById('productCouverture').value  = product ? product.couverture_max : '';
  document.getElementById('productDescription').value = product ? product.description : '';
  document.getElementById('productModalTitle').textContent = product ? 'Modifier le produit' : 'Ajouter un produit';
  Modal.open('productModal');
}

function editProduct(id) {
  const product = allProducts.find(p => p.id === id);
  if (product) openProductModal(product);
}

function openDeleteModal(id, nom) {
  deleteProductId = id;
  document.getElementById('deleteProductName').textContent = nom;
  Modal.open('deleteModal');
}

async function saveProduct() {
  const id          = document.getElementById('productId').value;
  const nom         = document.getElementById('productNom').value.trim();
  const type_produit= document.getElementById('productType').value;
  const prime       = document.getElementById('productPrime').value;
  const couverture  = document.getElementById('productCouverture').value;
  const description = document.getElementById('productDescription').value.trim();

  if (!nom || !prime || !couverture || !description) {
    Toast.show('Champs requis', 'error', 'Remplissez tous les champs obligatoires.');
    return;
  }

  const btn = document.getElementById('productSaveBtn');
  btn.disabled = true;
  btn.textContent = 'Enregistrement…';

  const payload = { nom, type_produit, prime_mensuelle: Number(prime), couverture_max: Number(couverture), description };

  try {
    if (id) {
      await Http.patch(API.insuranceProductDetail(Number(id)), payload);
      Toast.show('Produit modifié', 'success');
    } else {
      await Http.post(API.insuranceProductManage, payload);
      Toast.show('Produit créé', 'success');
    }
    Modal.close('productModal');
    await loadAdminProducts();
  } catch (err) {
    Toast.show('Erreur', 'error', err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Enregistrer';
  }
}

async function confirmDeleteProduct() {
  if (!deleteProductId) return;
  try {
    await Http.delete(API.insuranceProductDetail(deleteProductId));
    Modal.close('deleteModal');
    Toast.show('Produit supprimé', 'success');
    await loadAdminProducts();
  } catch (err) {
    Toast.show('Erreur', 'error', err.message);
  }
}

async function resilierPolicy(id) {
  if (!confirm('Résilier cette police ?')) return;
  try {
    await Http.patch(API.insuranceResilier(id), {});
    Toast.show('Police résiliée', 'success');
    await loadAdminPolicies();
  } catch (err) {
    Toast.show('Erreur', 'error', err.message);
  }
}

window.filterPolicies      = filterPolicies;
window.showInsuranceTab    = showInsuranceTab;
window.openProductModal    = openProductModal;
window.editProduct         = editProduct;
window.openDeleteModal     = openDeleteModal;
window.saveProduct         = saveProduct;
window.confirmDeleteProduct = confirmDeleteProduct;
window.resilierPolicy      = resilierPolicy;

document.addEventListener('DOMContentLoaded', () => initInsurances());