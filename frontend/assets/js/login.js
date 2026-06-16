'use strict';

/* ── Redirection si déjà connecté ─────────────────────────── */
(function() {
  if (typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
    const user = Auth.getUser();
    const dest = (user && user.role === 'CLIENT') ? 'client-dashboard.html'
               : (user && user.role === 'AGENT')  ? 'agent-dashboard.html'
               : 'admin-dashboard.html';
    window.location.href = (typeof APP_ROOT !== 'undefined' ? APP_ROOT : '') + dest;
  }
})();

/* ── Handler de connexion ──────────────────────────────────── */
async function handleLogin(e) {
  e.preventDefault();

  const btn   = document.getElementById('loginBtn');
  const errEl = document.getElementById('loginError');
  const email = document.getElementById('loginEmail').value.trim();
  const pw    = document.getElementById('loginPassword').value;

  errEl.style.display = 'none';

  if (!email || !pw) {
    errEl.textContent = 'Veuillez saisir votre email et votre mot de passe.';
    errEl.style.display = 'block';
    return;
  }

  const origHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span style="display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;vertical-align:middle;margin-right:8px"></span>Connexion…';

  try {
    const data = await Http.post(API.login, { email, password: pw });

    if (!data || !data.tokens || !data.user) {
      throw new Error('Réponse inattendue du serveur.');
    }

    Auth.save(data.tokens, data.user);
    btn.innerHTML = '✓ Connecté !';
    btn.style.background = '#16a34a';

    const dest = data.user.role === 'CLIENT' ? 'client-dashboard.html'
               : data.user.role === 'AGENT'  ? 'agent-dashboard.html'
               : 'admin-dashboard.html';
    setTimeout(() => {
      window.location.href = APP_ROOT + dest;
    }, 400);

  } catch (err) {
    let msg = (err && err.message) ? err.message : 'Erreur de connexion.';
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
window.handleLogin = handleLogin;