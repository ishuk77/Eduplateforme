# API et architecture

Architecture modulaire: domaine → service applicatif → repositories → routes HTTP → client responsive. L’API JSON est la source de vérité de l’interface. SQLite cible le développement local; PostgreSQL cible la production et est vérifié avec `pg-mem`.

Surfaces finales: `/dashboards/me`, `/analytics`, `/analytics/export`, `/auth/mfa/*`, `/auth/sessions`, `/offline/synchronize`, `/support/tickets`, `/saas/*`, `/ai/assist`, `/operations/*`, `/healthz`, `/readyz`, `/metrics`.

Les erreurs utilisent un code HTTP et un payload explicite. Les opérations externes restent dans un état d’attente ou d’échec traçable. Les navigateurs modernes avec modules ES, Service Worker et IndexedDB/localStorage sont visés.
