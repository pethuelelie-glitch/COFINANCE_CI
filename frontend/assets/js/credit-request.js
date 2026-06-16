'use strict';

const CreditRequestPage = {
  async init() {
    if (!Auth.requireLogin()) return;
    Sidebar.init();
  },

  async submit(e) {
    e.preventDefault();
    const btn    = document.getElementById('submitBtn');
    const errEl  = document.getElementById('requestError');
    const montant = parseFloat(document.getElementById('montant')?.value) || 0;
    const duree   = parseInt(document.getElementById('duree_mois')?.value) || 0;
    const motif   = document.getElementById('motif')?.value || '';
    const desc    = document.getElementById('description')?.value || '';
    const taux    = parseFloat(document.getElementById('taux_interet')?.value) || 5;

    errEl.style.display = 'none';
    if (!montant || montant < 10000) { errEl.textContent = 'Montant minimum : 10 000 FCFA.'; errEl.style.display = 'block'; return; }
    if (!duree)  { errEl.textContent = 'Veuillez sélectionner une durée.'; errEl.style.display = 'block'; return; }
    if (!motif)  { errEl.textContent = 'Veuillez sélectionner un motif.'; errEl.style.display = 'block'; return; }

    const origHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span style="display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;vertical-align:middle;margin-right:8px"></span>Envoi…';

    try {
      await Http.post(API.credits, {
        montant_demande: montant,
        duree_mois: duree,
        taux_interet: taux,
        motif,
        description: desc,
      });
      btn.innerHTML = '✓ Demande envoyée !';
      btn.style.background = '#16a34a';
      Toast.show('Demande soumise !', 'success', 'Vous serez contacté sous 48h.');
      setTimeout(() => { window.location.href = APP_ROOT + 'credits.html'; }, 1200);
    } catch (err) {
      errEl.textContent = err?.message || 'Erreur lors de la soumission.';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.innerHTML = origHTML;
      btn.style.background = '';
    }
  },
};

function updateSimulator() {
  const montant = parseFloat(document.getElementById('montant').value) || 0;
  const duree = parseInt(document.getElementById('duree_mois').value) || 0;
  const taux = parseFloat(document.getElementById('taux_interet').value) || 0;
  const sim = document.getElementById('simulateur');
  if (montant > 0 && duree > 0) {
    sim.style.display = 'block';
    const tauxM = (taux / 100) / 12;
    let mensualite;
    if (tauxM === 0) {
      mensualite = montant / duree;
    } else {
      mensualite = montant * (tauxM * Math.pow(1 + tauxM, duree)) / (Math.pow(1 + tauxM, duree) - 1);
    }
    document.getElementById('sim-mensualite').textContent = Fmt.money(mensualite) + ' FCFA';
    document.getElementById('sim-total').textContent = Fmt.money(mensualite * duree) + ' FCFA';
  } else {
    sim.style.display = 'none';
  }
}

window.CreditRequestPage = CreditRequestPage;
document.addEventListener('DOMContentLoaded', () => {
  CreditRequestPage.init();
  ['montant', 'duree_mois', 'taux_interet'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateSimulator);
    document.getElementById(id)?.addEventListener('change', updateSimulator);
  });
});