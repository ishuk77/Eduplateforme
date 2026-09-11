const navigation = document.querySelector('#shell-nav');
const menuToggle = document.querySelector('#menu-toggle');
const navBackdrop = document.querySelector('#nav-backdrop');
const mobileMediaQuery = window.matchMedia('(min-width: 960px)');
const summaryGrid = document.querySelector('#summary-grid');
const authStatus = document.querySelector('#auth-status');

const apiClient = {
  async getJson(path, { token = null } = {}) {
    const headers = token ? { Authorization: 'Bearer ' + token } : {};
    const response = await fetch(path, { headers });
    if (!response.ok) {
      return null;
    }
    return response.json();
  },
  getFoundationSummary() {
    return this.getJson('/meta/foundation');
  },
  getAuthenticatedUser(token) {
    return this.getJson('/auth/me', { token });
  }
};

function setNavigationState(isOpen) {
  if (!navigation || !menuToggle || !navBackdrop) {
    return;
  }

  navigation.setAttribute('data-open', String(isOpen));
  menuToggle.setAttribute('aria-expanded', String(isOpen));
  navBackdrop.hidden = !isOpen;
}

async function loadPlatformSummary() {
  if (!summaryGrid) {
    return;
  }

  try {
    const platform = await apiClient.getFoundationSummary();
    if (!platform) {
      return;
    }
    summaryGrid.innerHTML = `
      <article class="module-card"><p class="section-label">Scope</p><h3>${platform.scope}</h3><p>${platform.modules.length} modules advertised by the backend foundation.</p></article>
      <article class="module-card"><p class="section-label">Organizations</p><h3>${platform.summary.organizations}</h3><p>Tenant records currently persisted by the backend.</p></article>
      <article class="module-card"><p class="section-label">People</p><h3>${platform.summary.people}</h3><p>Identity records available through `/people` endpoints.</p></article>
      <article class="module-card"><p class="section-label">Accounts</p><h3>${platform.summary.accounts}</h3><p>Accounts secured by JWT authentication.</p></article>
      <article class="module-card"><p class="section-label">Enrollments</p><h3>${platform.summary.enrollments}</h3><p>Academic enrollments exposed through read/list APIs.</p></article>
      <article class="module-card"><p class="section-label">Documents</p><h3>${platform.summary.documents}</h3><p>Versioned documents and credentials with archive history.</p></article>
      <article class="module-card"><p class="section-label">Audit events</p><h3>${platform.summary.events}</h3><p>Ordered events captured from domain and security actions.</p></article>
    `;
  } catch {
    // ignore shell decoration failure
  }
}

async function loadAuthContext() {
  if (!authStatus) {
    return;
  }

  const token = window.localStorage.getItem('eduplateforme.accessToken');
  if (!token) {
    authStatus.textContent = 'Anonymous shell context';
    return;
  }

  try {
    const me = await apiClient.getAuthenticatedUser(token);
    if (!me) {
      authStatus.textContent = 'Stored session expired';
      return;
    }

    authStatus.textContent = `Authenticated as ${me.username} (${me.organizationId ?? 'no org selected'})`;
  } catch {
    authStatus.textContent = 'Unable to load auth context';
  }
}

if (navigation && menuToggle && navBackdrop) {
  setNavigationState(false);

  menuToggle.addEventListener('click', () => {
    const isOpen = navigation.getAttribute('data-open') === 'true';
    setNavigationState(!isOpen);
  });

  navBackdrop.addEventListener('click', () => {
    setNavigationState(false);
  });

  navigation.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      if (!mobileMediaQuery.matches) {
        setNavigationState(false);
      }
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setNavigationState(false);
    }
  });

  mobileMediaQuery.addEventListener('change', (event) => {
    setNavigationState(false);
    navBackdrop.hidden = !event.matches;
    if (event.matches) {
      navBackdrop.hidden = true;
    }
  });
}

await Promise.all([loadPlatformSummary(), loadAuthContext()]);
