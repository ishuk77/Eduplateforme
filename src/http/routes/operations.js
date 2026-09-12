import { authorizeRequest, requireIdentity } from '../middleware/auth.js';
import { parseJson, parsePagination } from '../middleware/validation.js';
import { ApiError } from '../../shared/errors.js';
import { makeCrudHandlers } from './_helpers.js';

const CRUD_RESOURCES = Object.freeze([
  ['/analytics/configurations', 'analyticsConfigurations', 'analytics'],
  ['/support/tickets', 'supportTickets', 'support'],
  ['/saas/plans', 'saasPlans', 'saas'],
  ['/saas/subscriptions', 'tenantSubscriptions', 'saas'],
  ['/operations/backup-configurations', 'backupConfigurations', 'operations'],
  ['/operations/backups', 'backupOperations', 'operations'],
  ['/operations/incidents', 'incidents', 'operations'],
  ['/ai/requests', 'aiAssistanceRequests', 'ai-assistance'],
  ['/offline/journal', 'syncJournal', 'operations']
]);

function getScopedOrganization(request, service, candidate = null) {
  const identity = requireIdentity(request, service);
  const organizationId = candidate
    ?? identity.organizationId
    ?? (identity.organizationIds.length === 1 ? identity.organizationIds[0] : null);
  if (!organizationId) throw new ApiError('INVALID_INPUT', 'organizationId is required.', 400);
  return { identity, organizationId };
}

function registerCrud(router, service, [path, resource, permission]) {
  const handlers = makeCrudHandlers({
    service,
    resource,
    create: (body, actorId) =>
      service.createOperationalRecord(resource, body, actorId, `${resource}.create`),
    readPermission: `${permission}.read`,
    writePermission: `${permission}.write`
  });
  router.add('POST', path, handlers.create);
  router.add('GET', path, handlers.list);
  router.add('GET', `${path}/:id`, handlers.get);
  router.add('PUT', `${path}/:id`, handlers.update);
  router.add('DELETE', `${path}/:id`, handlers.remove);
  router.add('GET', `${path}/:id/history`, handlers.history);
}

export function registerOperationsRoutes(router, { service }) {
  for (const resource of CRUD_RESOURCES) registerCrud(router, service, resource);

  router.add('GET', '/support/help', async (request, url) => {
    const { organizationId } = getScopedOrganization(request, service, url.searchParams.get('organizationId'));
    authorizeRequest(request, service, { organizationId });
    return Response.json({
      version: '1.0',
      guides: [
        {
          id: 'organizations',
          title: 'Organisation et institution',
          audience: ['platform-admin', 'school-admin', 'university-admin', 'training-center-admin'],
          permissions: ['organizations.write', 'institution.write', 'academics.write'],
          prerequisites: ['Compte administrateur actif'],
          workflow: ['Choisir le type et le pays', 'Laisser générer la référence interne ou ouvrir les options avancées', 'Configurer fuseau, format de date et géolocalisation facultative', 'Ajouter ensuite d’autres institutions si nécessaire'],
          actions: ['Créer une institution', 'Distinguer référence interne, identifiant national et identifiant local', 'Téléverser les preuves dans Identité & preuves']
        },
        {
          id: 'referenceEntries',
          title: 'Référentiels, catalogues et codification',
          audience: ['admin'],
          permissions: ['references.read', 'references.write'],
          prerequisites: ['Organisation active'],
          workflow: ['Choisir une famille de catalogue', 'Définir un code stable', 'Renseigner des libellés localisés', 'Prévisualiser un CSV/XLSX avant application'],
          actions: ['Créer manuellement', 'Télécharger le modèle', 'Importer catalog,code,labelFr,labelEn,labelEs,labelPt,labelAr,countryCode']
        },
        {
          id: 'years',
          title: 'Années académiques',
          audience: ['admin'],
          permissions: ['academics.write'],
          prerequisites: ['Organisation active'],
          workflow: ['Saisir le libellé affiché', 'Choisir début et fin', 'Accepter le code technique généré ou le personnaliser'],
          actions: ['Créer', 'Vérifier que la fin suit le début']
        },
        {
          id: 'academicPeriods',
          title: 'Périodes académiques',
          audience: ['admin'],
          permissions: ['academics.write'],
          prerequisites: ['Année académique créée'],
          workflow: ['Choisir semestre ou trimestre', 'Attribuer un numéro unique', 'Saisir des dates contenues dans l’année'],
          actions: ['Créer', 'Contrôler séquence et dates']
        },
        {
          id: 'classes',
          title: 'Classes, groupes et sections',
          audience: ['admin'],
          permissions: ['academics.write'],
          prerequisites: ['Année, programme et niveau créés'],
          workflow: ['Utiliser name comme libellé affiché', 'Utiliser code comme identifiant stable', 'Affecter niveau et programme', 'Importer la liste des personnes'],
          actions: ['Créer une classe', 'Importer CSV/XLSX']
        },
        {
          id: 'people',
          title: 'Personnes et import unifié',
          audience: ['admin'],
          permissions: ['people.write', 'profiles.write', 'academics.write', 'accounts.write'],
          prerequisites: ['Classes créées pour les apprenants', 'Campus créé pour les professionnels'],
          workflow: ['Choisir personType', 'Compléter les colonnes conditionnelles', 'Prévisualiser les erreurs et doublons', 'Appliquer transactionnellement', 'Télécharger une seule fois les identifiants'],
          actions: ['Importer apprenants/étudiants/stagiaires', 'Importer parents/responsables', 'Importer enseignants/formateurs/staff']
        },
        {
          id: 'accounts',
          title: 'Comptes des apprenants et responsables',
          audience: ['admin'],
          permissions: ['accounts.write'],
          prerequisites: ['Personne et profil créés'],
          workflow: ['Choisir parent, learner ou both lorsque le niveau ne détermine pas la règle', 'Utiliser le matricule comme identifiant apprenant', 'Remettre le mot de passe temporaire une seule fois', 'Forcer son changement à la première connexion'],
          actions: ['Créer sans adresse courriel pour un apprenant', 'Ne pas activer la connexion téléphonique sans OTP vérifié']
        },
        {
          id: 'payment-activation',
          title: 'Activation selon frais et paiements',
          audience: ['admin', 'finance', 'learner'],
          permissions: ['finance.write', 'finance.read', 'lms.read'],
          prerequisites: ['Apprenant inscrit', 'Politique institution ou programme configurée'],
          workflow: ['Choisir aucun paiement, frais payé, seuil pourcentage/montant ou solde intégral', 'Émettre la facture', 'Enregistrer les paiements', 'Laisser le serveur activer les données académiques'],
          actions: ['Configurer la gratuité', 'Afficher un état en attente sans fuite de données']
        },
        {
          id: 'daily-operations',
          title: 'Opérations quotidiennes',
          audience: ['admin', 'teacher', 'trainer', 'learner', 'student', 'parent', 'guardian'],
          permissions: ['academics.read', 'attendance.read', 'grading.read', 'lms.read'],
          prerequisites: ['Configuration académique terminée'],
          workflow: ['Inscrire', 'Planifier et enseigner', 'Saisir présences et notes', 'Publier les documents'],
          actions: ['Consulter', 'Saisir selon le rôle', 'Exporter lorsque permis']
        },
        {
          id: 'bulk-import',
          title: 'Imports CSV/XLSX',
          audience: ['school-admin', 'university-admin', 'training-center-admin'],
          permissions: ['academics.write'],
          prerequisites: ['Connexion en ligne', 'Année/programme/classe créés', 'Fichier conforme au modèle'],
          workflow: ['Télécharger le modèle', 'Choisir CSV ou XLSX', 'Prévisualiser et corriger toutes les erreurs', 'Confirmer puis appliquer', 'Télécharger immédiatement les identifiants temporaires'],
          actions: ['Dry-run', 'Application transactionnelle', 'Export unique des identifiants']
        },
        {
          id: 'profiles',
          title: 'Profil personnel et confidentialité',
          audience: ['all authenticated roles'],
          permissions: ['self-service', 'people.read', 'people.write'],
          prerequisites: ['Compte rattaché à une personne'],
          workflow: ['Modifier ses préférences et contacts', 'Consentir avant les données d’urgence', 'Ajouter une photo sûre', 'Faire corriger les champs officiels par un administrateur'],
          actions: ['Self-service limité', 'Administration des champs officiels', 'Consultation des rôles sans auto-escalade']
        },
        {
          id: 'documents',
          title: 'Logo, signatures et documents de preuve',
          audience: ['admin', 'records officer', 'learner'],
          permissions: ['organizations.write', 'credentials.write', 'documents.write', 'documents.verify'],
          prerequisites: ['Personne existante', 'Connexion en ligne', 'Fichier conforme'],
          workflow: ['Configurer le logo', 'Habiliter les signataires', 'Téléverser PDF/PNG/JPEG', 'Vérifier ou rejeter avec motif', 'Télécharger via contrôle d’accès'],
          actions: ['Remplacer/révoquer', 'Vérifier le SHA-256', 'Consulter l’audit']
        },
        {
          id: 'lms',
          title: 'Cours, chapitres, leçons, quiz et titres',
          audience: ['teacher', 'trainer', 'learner', 'student', 'admin'],
          permissions: ['lms.read', 'lms.write', 'credentials.write'],
          prerequisites: ['Programme et cours académiques', 'Participant et inscription LMS'],
          workflow: ['Ordonner chapitres et leçons', 'Configurer quiz/seuil/tentatives', 'Valider les prérequis côté serveur', 'Passer l’examen final', 'Délivrer un titre si éligible'],
          actions: ['Créer le contenu', 'Soumettre une tentative', 'Valider une leçon', 'Délivrer/révoquer un titre']
        },
        {
          id: 'governance',
          title: 'Gouvernance et exploitation',
          audience: ['platform-admin', 'admin', 'support'],
          permissions: ['audit.read', 'operations.read', 'security.read'],
          prerequisites: ['Permission explicite'],
          workflow: ['Contrôler les événements', 'Suivre qualité et incidents', 'Vérifier sauvegardes et conformité'],
          actions: ['Consulter les traces', 'Ouvrir un ticket', 'Demander une opération externe']
        }
      ],
      faq: [
        { question: 'Quelles actions fonctionnent hors ligne ?', answer: 'Les brouillons explicitement autorisés; les données officielles exigent une connexion.' },
        { question: 'Comment escalader un ticket ?', answer: 'Affectez le niveau L1, L2, L3 ou L4 et ajoutez un commentaire traçable.' },
        { question: 'Pourquoi une liste est-elle indisponible ?', answer: 'Le prérequis doit être créé et vous devez disposer du droit de lecture correspondant. L’interface affiche un lien vers le module concerné.' },
        { question: 'Les cinq langues sont-elles intégralement traduites ?', answer: 'La navigation générale et les états sont localisés. Certains libellés métier utilisent encore le français de référence comme fallback non vide.' }
        ,
        { question: 'Les signatures et diplômes ont-ils une valeur juridique garantie ?', answer: 'Non. Une signature est une marque visuelle auditée. Un titre est émis par la plateforme et ne doit être présenté comme officiel ou accrédité que si une autorité valide est configurée et vérifiée.' },
        { question: 'Où sont stockés les fichiers ?', answer: 'Les logos, signatures, avatars et preuves sont stockés de façon bornée dans la base configurée; aucun fichier ne dépend du disque éphémère de Render.' }
      ],
      localeCoverage: {
        supported: ['fr', 'en', 'es', 'pt', 'ar'],
        rtl: ['ar'],
        complete: false,
        fallback: 'fr'
      }
    });
  });

  router.add('GET', '/dashboards/me', async (request, url) => {
    const { identity, organizationId } = getScopedOrganization(
      request,
      service,
      url.searchParams.get('organizationId')
    );
    authorizeRequest(request, service, { organizationId });
    return Response.json(service.getRoleDashboard(identity.accountId, organizationId));
  });

  router.add('GET', '/analytics', async (request, url) => {
    const { organizationId } = getScopedOrganization(request, service, url.searchParams.get('organizationId'));
    authorizeRequest(request, service, { organizationId, permissions: ['analytics.read'] });
    const filters = Object.fromEntries(
      ['period', 'levelCode', 'classId', 'programId', 'campusId', 'subjectId']
        .map((key) => [key === 'levelCode' ? 'levelCode' : key, url.searchParams.get(key)])
        .filter(([, value]) => value)
    );
    return Response.json(service.buildAnalytics({ organizationId, filters }));
  });

  router.add('GET', '/analytics/export', async (request, url) => {
    const { organizationId } = getScopedOrganization(request, service, url.searchParams.get('organizationId'));
    authorizeRequest(request, service, { organizationId, permissions: ['analytics.export'] });
    const exported = service.exportAnalytics({
      organizationId,
      format: url.searchParams.get('format') ?? 'json',
      filters: Object.fromEntries(
        ['period', 'levelCode', 'classId', 'programId', 'campusId', 'subjectId']
          .map((key) => [key, url.searchParams.get(key)])
          .filter(([, value]) => value)
      )
    });
    return new Response(exported.body, {
      headers: {
        'content-type': exported.contentType,
        'content-disposition': `attachment; filename="${exported.filename}"`
      }
    });
  });

  router.add('POST', '/support/tickets/:id/comments', async (request, _url, params) => {
    const ticket = await service.getCrudResource('supportTickets', params.id);
    const identity = authorizeRequest(request, service, {
      organizationId: ticket.organizationId,
      permissions: ['support.write']
    });
    return Response.json(await service.addSupportComment(params.id, await parseJson(request), identity.actorId));
  });

  router.add('POST', '/saas/entitlements/check', async (request) => {
    const body = await parseJson(request);
    authorizeRequest(request, service, {
      organizationId: body.organizationId,
      permissions: ['saas.read']
    });
    return Response.json(service.checkEntitlement(body.organizationId, body.feature, body.usage ?? {}));
  });

  router.add('POST', '/operations/backups/request', async (request) => {
    const body = await parseJson(request);
    const identity = authorizeRequest(request, service, {
      organizationId: body.organizationId,
      permissions: ['operations.write']
    });
    return Response.json(await service.requestBackup(body, identity.actorId), { status: 202 });
  });

  router.add('POST', '/operations/demo-accounts/provision', async (request) => {
    const body = await parseJson(request);
    const identity = authorizeRequest(request, service, {
      organizationId: body.organizationId,
      permissions: ['accounts.write', 'people.write']
    });
    if (!service.getRoleCodes(identity.accountId, body.organizationId).includes('tenant-admin')) {
      throw new ApiError('FORBIDDEN', 'Only a tenant administrator can provision preview accounts.', 403);
    }
    return Response.json(
      await service.provisionPreviewAccounts(body.organizationId, identity.accountId),
      { status: 201 }
    );
  });

  router.add('POST', '/ai/assist', async (request) => {
    const body = await parseJson(request);
    const identity = authorizeRequest(request, service, {
      organizationId: body.organizationId,
      permissions: ['ai-assistance.write']
    });
    return Response.json(await service.requestAiAssistance(body, identity.actorId), { status: 202 });
  });

  router.add('POST', '/offline/synchronize', async (request) => {
    const body = await parseJson(request);
    const identity = authorizeRequest(request, service, {
      organizationId: body.organizationId
    });
    return Response.json(await service.processOfflineMutations(body, identity.actorId));
  });

  router.add('GET', '/operations/status', async (request, url) => {
    const { organizationId } = getScopedOrganization(request, service, url.searchParams.get('organizationId'));
    authorizeRequest(request, service, { organizationId, permissions: ['operations.read'] });
    const incidents = await service.listCrudResource('incidents', {
      organizationId,
      ...parsePagination(url)
    });
    return Response.json({
      serviceState: incidents.items.some((item) => item.incidentState === 'open') ? 'degraded' : 'operational',
      incidents
    });
  });
}
