const overviewPillars = [
  {
    title: 'Responsive foundation',
    detail: 'Mobile-first layout primitives keep the shell usable on phones, tablets, and desktop browsers from the first iteration.',
  },
  {
    title: 'Modular domain map',
    detail: 'Core future areas stay separated so the application can grow with clear boundaries instead of a monolithic interface.',
  },
  {
    title: 'Extensible delivery path',
    detail: 'The shell can evolve into richer web workflows, a PWA, and eventually mobile-specific packaging without replacing the baseline.',
  },
];

const nextSteps = [
  'Connect module placeholders to real domain services.',
  'Introduce authenticated user contexts and tenant-aware data.',
  'Add progressive enhancement such as offline support and installability.',
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

export function renderAppShell({ currentModule, modules }) {
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
          <h3>First usable app shell</h3>
          <p>Set up a lightweight front-end baseline that is already comfortable on mobile and ready to grow by domain.</p>
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
              <span class="status-chip">Placeholder routes</span>
              <span class="status-chip">PWA-ready path</span>
            </div>
          </section>

          <section class="three-column-grid">
            ${renderOverviewCards()}
          </section>

          <section class="two-column-grid">
            ${renderHighlights('Selected module focus', currentModule.highlights)}
            ${renderHighlights('Suggested next milestones', nextSteps)}
          </section>

          <section class="surface-card">
            <div class="section-header">
              <div>
                <p class="section-label">Domain navigation</p>
                <h2>Future application areas</h2>
              </div>
              <p class="section-copy">Each area is intentionally lightweight today and isolated enough to evolve into dedicated workflows later.</p>
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
