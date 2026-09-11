const overviewPillars = [
  {
    title: 'Responsive foundation',
    detail: 'Mobile-first layout primitives keep the shell usable on phones, tablets, and desktop browsers.',
  },
  {
    title: 'Modular domain map',
    detail: 'Core areas stay isolated so each backend capability can evolve behind shared navigation and security.',
  },
  {
    title: 'Live backend integration',
    detail: 'The shell reads platform metadata and authenticated user context from the same HTTP server that exposes the API.',
  },
];

const nextSteps = [
  'Connect dashboards to filtered list endpoints.',
  'Reuse JWT login state across shell modules.',
  'Add richer role-specific workflows on top of CRUD APIs.',
];

function renderModuleNavigation(currentModule, modules) {
  return modules
    .map(
      (module) => `
        <a class="nav-link${module.id === currentModule.id ? ' is-active' : ''}" href="${module.path}">
          <span class="nav-link__label">${module.label}</span>
          <span class="nav-link__meta">${module.eyebrow}</span>
        </a>
      `,
    )
    .join('');
}

function renderHighlights(title, items) {
  return `
    <section class="surface-card">
      <p class="section-label">${title}</p>
      <ul class="feature-list">
        ${items.map((item) => `<li>${item}</li>`).join('')}
      </ul>
    </section>
  `;
}

function renderOverviewCards() {
  return overviewPillars
    .map(
      (pillar) => `
        <article class="surface-card">
          <h3>${pillar.title}</h3>
          <p>${pillar.detail}</p>
        </article>
      `,
    )
    .join('');
}

function renderModuleCards(modules) {
  return modules
    .map(
      (module) => `
        <a class="module-card" href="${module.path}">
          <p class="section-label">${module.eyebrow}</p>
          <h3>${module.title}</h3>
          <p>${module.description}</p>
        </a>
      `,
    )
    .join('');
}

export function renderAppShell({ currentModule, modules, platform }) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#1d4ed8">
    <title>Eduplateforme · ${currentModule.title}</title>
    <link rel="manifest" href="/manifest.webmanifest">
    <link rel="stylesheet" href="/styles.css">
  </head>
  <body>
    <div class="app-shell">
      <aside class="shell-nav" id="shell-nav" data-open="false" aria-label="Primary navigation">
        <div class="brand-block">
          <a class="brand-mark" href="/dashboard">Eduplateforme</a>
          <p class="brand-copy">Educational SaaS foundation for governed, modular institution operations.</p>
        </div>
        <nav class="nav-links">
          ${renderModuleNavigation(currentModule, modules)}
        </nav>
        <section class="surface-card shell-note">
          <p class="section-label">Current objective</p>
          <h3>Integrated shell + backend</h3>
          <p>JWT-secured APIs, SQL-backed persistence, and a shell that reads live platform metadata from the same service.</p>
        </section>
      </aside>

      <button class="nav-backdrop" id="nav-backdrop" type="button" hidden aria-label="Close navigation"></button>

      <div class="shell-main">
        <header class="topbar">
          <button class="menu-toggle" id="menu-toggle" type="button" aria-controls="shell-nav" aria-expanded="false">
            Menu
          </button>
          <div>
            <p class="section-label">${currentModule.eyebrow}</p>
            <h1>${currentModule.title}</h1>
          </div>
          <a class="topbar-link" href="/dashboard">Platform overview</a>
        </header>

        <main class="content-stack">
          <section class="hero surface-card">
            <div class="hero-copy">
              <p class="section-label">Web/mobile foundation</p>
              <h2>Modular user experience for the next Eduplateforme capabilities</h2>
              <p>${currentModule.description}</p>
            </div>
            <div class="hero-panel">
              <span class="status-chip">Responsive shell</span>
              <span class="status-chip">SQL persistence</span>
              <span class="status-chip">JWT security</span>
            </div>
          </section>

          <section class="three-column-grid">
            ${renderOverviewCards()}
          </section>

          <section class="two-column-grid">
            ${renderHighlights('Selected module focus', currentModule.highlights)}
            ${renderHighlights('Suggested next milestones', nextSteps)}
          </section>

          <section class="surface-card" id="platform-summary" data-modules="${platform.modules.length}">
            <div class="section-header">
              <div>
                <p class="section-label">Live platform status</p>
                <h2>Backend foundation summary</h2>
              </div>
              <p class="section-copy" id="auth-status">Anonymous shell context</p>
            </div>
            <div class="module-grid" id="summary-grid">
              <article class="module-card"><p class="section-label">Scope</p><h3>${platform.scope}</h3><p>${platform.modules.length} modules advertised by the backend foundation.</p></article>
              <article class="module-card"><p class="section-label">Organizations</p><h3>${platform.summary.organizations}</h3><p>Tenant records currently persisted by the backend.</p></article>
              <article class="module-card"><p class="section-label">Audit events</p><h3>${platform.summary.events}</h3><p>Ordered events captured from domain and security actions.</p></article>
            </div>
          </section>

          <section class="surface-card">
            <div class="section-header">
              <div>
                <p class="section-label">Domain navigation</p>
                <h2>Application areas</h2>
              </div>
              <p class="section-copy">Each area can now be paired with live CRUD endpoints and organization-scoped authorization.</p>
            </div>
            <div class="module-grid">
              ${renderModuleCards(modules)}
            </div>
          </section>
        </main>
      </div>
    </div>

    <script type="module" src="/app.js"></script>
  </body>
</html>`;
}
