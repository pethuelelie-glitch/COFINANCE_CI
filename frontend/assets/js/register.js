'use strict';

/* ── Redirection si déjà connecté ─────────────────────────── */
(function() {
  if (typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
    window.location.href = (typeof APP_ROOT !== 'undefined' ? APP_ROOT : '') + 'client-dashboard.html';
  }
})();

/* ── Handler d'inscription ─────────────────────────────────── */
async function handleRegister(e) {
  e.preventDefault();

  const btn    = document.getElementById('regBtn');
  const errEl  = document.getElementById('regError');
  const first  = document.getElementById('regFirst').value.trim();
  const last   = document.getElementById('regLast').value.trim();
  const email  = document.getElementById('regEmail').value.trim();
  const phone  = document.getElementById('regPhone').value.trim();
  const pw     = document.getElementById('regPassword').value;
  const pw2    = document.getElementById('regPassword2').value;
  const dob    = document.getElementById('regDOB').value;

  errEl.style.display = 'none';

  if (!first || !last || !email || !pw) {
    errEl.textContent = 'Veuillez remplir tous les champs obligatoires (*)';
    errEl.style.display = 'block';
    return;
  }
  if (pw !== pw2) {
    errEl.textContent = 'Les mots de passe ne correspondent pas.';
    errEl.style.display = 'block';
    return;
  }
  if (pw.length < 8) {
    errEl.textContent = 'Le mot de passe doit contenir au moins 8 caractères.';
    errEl.style.display = 'block';
    return;
  }

  const payload = {
    email,
    first_name:       first,
    last_name:        last,
    password:         pw,
    password_confirm: pw2,
  };
  if (phone) {
    payload.phone = phone.startsWith('+') ? phone : '+225' + phone.replace(/\s/g, '');
  }
  if (dob) payload.date_naissance = dob;

  const origHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span style="display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;vertical-align:middle;margin-right:8px"></span>Création…';

  try {
    const res = await Http.post(API.register, payload);

    if (!res || !res.tokens || !res.user) {
      throw new Error('Réponse inattendue du serveur.');
    }

    Auth.save(res.tokens, res.user);
    btn.innerHTML = '✓ Compte créé ! Redirection…';
    btn.style.background = '#16a34a';

    setTimeout(() => {
      window.location.href = APP_ROOT + 'client-dashboard.html';
    }, 600);

  } catch (err) {
    let msg = (err && err.message) ? err.message : 'Erreur lors de la création du compte.';
    if (typeof msg === 'object') msg = JSON.stringify(msg);
    if (msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('failed') || msg.toLowerCase().includes('network')) {
      msg = 'Impossible de joindre le serveur. Vérifiez que Django tourne sur http://127.0.0.1:8000';
    }
    errEl.textContent = msg;
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.innerHTML = origHtml;
    btn.style.background = '';
  }
}
window.handleRegister = handleRegister;