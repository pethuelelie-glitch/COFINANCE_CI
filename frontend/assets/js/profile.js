'use strict';

const ProfilePage = {
  async init() {
    if (!Auth.requireLogin()) return;
    Sidebar.init();
    const user = Auth.getUser();
    if (!user) return;

    if (user.role !== 'CLIENT') {
      const nav = document.querySelector('.sidebar-nav');
      if (nav) {
        if (user.role === 'AGENT') {
          nav.innerHTML = `
            <div class="nav-section-label">Mon espace</div>
            <a href="agent-dashboard.html" class="nav-item">Tableau de bord</a>
            <a href="admin-credits.html" class="nav-item">Mes crédits</a>
            <a href="admin-support.html" class="nav-item">Support client</a>
          `;
        } else {
          nav.innerHTML = `
            <div class="nav-section-label">Administration</div>
            <a href="admin-dashboard.html" class="nav-item">Tableau de bord</a>
            <a href="admin-clients.html" class="nav-item">Clients</a>
            <a href="admin-agents.html" class="nav-item">Agents</a>
            <a href="admin-credits.html" class="nav-item">Crédits (Kanban)</a>
            <a href="admin-insurances.html" class="nav-item">Assurances</a>
            <a href="admin-support.html" class="nav-item">Support</a>
          `;
        }
      }
    }

    document.querySelectorAll('[data-user-field]').forEach(el => {
      const field = el.dataset.userField;
      el.value = user[field] || '';
    });

    const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
    setText('profileName', name);
    setText('profileRole', { CLIENT:'Client', AGENT:'Agent', ADMIN:'Administrateur' }[user.role]);
    setText('profileEmail', user.email);
    document.querySelectorAll('.profile-avatar-lg').forEach(el => el.textContent = Fmt.initials(name));

    try {
      const fresh = await Http.get(API.profile);
      sessionStorage.setItem('user', JSON.stringify(fresh.data || fresh));
    } catch {}

    document.getElementById('profileForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('[type="submit"]');
      const origHTML = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span style="display:inline-block;width:14px;height:14px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:spin .7s linear infinite;vertical-align:middle;margin-right:6px"></span> Enregistrement...';

      const data = {};
      document.querySelectorAll('[data-user-field]').forEach(el => {
        if (el.disabled) return;
        const val = el.value.trim();
        if (val !== '') data[el.dataset.userField] = val;
      });

      try {
        const updated = await Http.patch(API.profile, data);
        const u = updated.data || updated;
        sessionStorage.setItem('user', JSON.stringify(u));
        Toast.show('Profil mis à jour', 'success');
        Sidebar.fillUser();
      } catch (err) {
        Toast.show('Erreur lors de la mise à jour', 'error', err.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = origHTML;
      }
    });
  },
};

function showTab(name, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  ['info', 'security'].forEach(t => {
    document.getElementById(`tab-${t}`).style.display = t === name ? '' : 'none';
  });
}

async function changePassword(e) {
  e.preventDefault();
  const oldPw  = document.getElementById('oldPassword').value;
  const newPw  = document.getElementById('newPassword').value;
  const confPw = document.getElementById('confirmNewPassword').value;
  if (newPw !== confPw) { Toast.show('Mots de passe différents', 'error'); return; }
  try {
    await Http.patch(API.profile, { old_password: oldPw, password: newPw });
    Toast.show('Mot de passe mis à jour', 'success');
    document.getElementById('passwordForm').reset();
  } catch (err) {
    Toast.show('Erreur', 'error', err.message);
  }
}

window.changePassword = changePassword;
window.showTab = showTab;
document.addEventListener('DOMContentLoaded', () => ProfilePage.init());