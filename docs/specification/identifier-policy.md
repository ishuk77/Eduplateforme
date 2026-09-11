# Politique des identifiants

Les identifiants internes sont des UUID permanents, opaques et non réutilisés. Les références nationales et locales sont des attributs distincts validés selon le pays. Un `organizationId` n’est jamais interchangeable avec un identifiant national; un `learnerId` n’est jamais une `enrollmentId`.

Les références publiques de vérification sont opaques et minimisent les données retournées. Les clés d’idempotence offline sont générées côté client et uniques par organisation. Les identifiants techniques de session ne contiennent aucun secret.
