# Sécurité et conformité

JWT court, refresh token HTTP-only, révocation de sessions, RBAC tenant-scoped, limitation de débit et audit couvrent l’authentification. Le MFA TOTP suit RFC 6238 avec fenêtre limitée; son secret est chiffré au repos et les recovery codes sont hashés puis consommés.

Les endpoints santé, readiness et métriques n’exposent ni variables d’environnement, ni URL de base, ni tokens, ni secrets. Les données sensibles utilisent le repository chiffré.

Cette implémentation vise WCAG 2.2 AA et les pratiques usuelles de sécurité, mais ne constitue ni certification WCAG, ni homologation juridique, ni garantie de haute disponibilité.
