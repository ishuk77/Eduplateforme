const navigation = document.querySelector('#shell-nav');
const menuToggle = document.querySelector('#menu-toggle');
const navBackdrop = document.querySelector('#nav-backdrop');
const mobileMediaQuery = window.matchMedia('(min-width: 960px)');
const summaryGrid = document.querySelector('#summary-grid');
const authStatus = document.querySelector('#auth-status');

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
    const response = await fetch('/meta/foundation');
    if (!response.ok) {
      return;
    }
    const platform = await response.json();
    summaryGrid.innerHTML = `
      <article class="module-card"><p class="section-label">Scope</p><h3>${platform.scope}</h3><p>${platform.modules.length} modules advertised by the backend foundation.</p></article>
      <article class="module-card"><p class="section-label">Organizations</p><h3>${platform.summary.organizations}</h3><p>Tenant records currently persisted by the backend.</p></article>
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
    const response = await fetch('/auth/me', {
      headers: { Authorization: 'Bearer ' + token }
    });

    if (!response.ok) {
      authStatus.textContent = 'Stored session expired';
      return;
    }

    const me = await response.json();
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
