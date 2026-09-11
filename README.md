# Eduplateforme

Responsive web/mobile application shell foundation for the Eduplateforme educational SaaS baseline.

## Run the application

```bash
npm install
npm start
```

The shell starts on `http://localhost:3000` by default. You can override the port with `PORT=4000 npm start`.

## Run the checks

```bash
npm test
```

## Current structure

- `src/server.js` serves the responsive shell and placeholder module routes.
- `src/modules.js` centralizes the platform navigation map and domain metadata.
- `src/template.js` renders the shared application shell layout.
- `public/` contains the reusable front-end assets for layout and interaction.
- `test/server.test.js` verifies the shell routes and static assets.

## Available placeholder routes

- `/dashboard`
- `/organizations`
- `/people`
- `/academics`
- `/documents`
- `/audit`

## Extension path

This first iteration intentionally stays lightweight. The shell is ready to be extended with real domain workflows, authenticated contexts, richer data integrations, and progressive web app capabilities without replacing the current modular navigation baseline.
