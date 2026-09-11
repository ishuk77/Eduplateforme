function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function renderAppShell({ currentModule }) {
  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#1d4ed8">
    <meta name="description" content="Gérez votre établissement scolaire avec Eduplateforme.">
    <title>Eduplateforme · ${escapeHtml(currentModule.title)}</title>
    <link rel="manifest" href="/manifest.webmanifest">
    <link rel="stylesheet" href="/styles.css">
  </head>
  <body>
    <a class="skip-link" href="#main-content">Aller au contenu principal</a>
    <div id="app" aria-live="polite">
      <main class="public-layout" id="main-content">
        <section class="surface-card loading-card">
          <p class="section-label">Eduplateforme</p>
          <h1>Chargement de votre espace…</h1>
        </section>
      </main>
    </div>
    <script type="module" src="/app.js"></script>
  </body>
</html>`;
}
