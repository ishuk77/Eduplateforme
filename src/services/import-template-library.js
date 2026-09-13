import { createHash } from 'node:crypto';

import ExcelJS from 'exceljs';

import { AcademicYear, Enrollment, Learner, LearningClass, Program } from '../domain/academics/academics.js';
import {
  AcademicLevel,
  AcademicPeriod,
  Campus,
  Course,
  GuardianLearnerRelation,
  GuardianProfile,
  ProfessionalAssignment,
  ProfessionalProfile,
  Subject
} from '../domain/institutional/institutional.js';
import { ReferenceEntry } from '../domain/learning-systems/learning-systems.js';
import { Person } from '../domain/people/person.js';
import { createPermanentId, ValidationError } from '../shared/entity.js';

const TEXT_FORMAT = '@';
const LIST_SEPARATOR = '|';

export const TEMPLATE_LIMITS = Object.freeze({
  maxFileBytes: 5 * 1024 * 1024,
  maxRows: 1000,
  maxColumns: 20,
  maxWorksheets: 8,
  maxCells: 20_000,
  maxZipEntries: 200,
  maxUncompressedBytes: 25 * 1024 * 1024
});

const field = (name, label, required, description, example, options = {}) => ({
  name, label, required, description, example, ...options
});

export const IMPORT_CONTRACTS = Object.freeze({
  references: {
    title: 'Données de référence',
    objective: 'Créer ou mettre à jour les codes tenant utilisés par les autres imports.',
    dependencies: [],
    permission: 'references.write',
    fields: [
      field('catalog', 'Catalogue', true, 'Famille stable de valeurs.', 'levels'),
      field('code', 'Code', true, 'Code stable unique dans le catalogue.', 'PRIMARY-1'),
      field('label_fr', 'Libellé français', false, 'Libellé français; FR ou EN est obligatoire.', 'Première année primaire'),
      field('label_en', 'Libellé anglais', false, 'Libellé anglais; FR ou EN est obligatoire.', 'Primary grade 1'),
      field('label_es', 'Libellé espagnol', false, 'Libellé espagnol facultatif.', 'Primer grado de primaria'),
      field('label_pt', 'Libellé portugais', false, 'Libellé portugais facultatif.', 'Primeiro ano do ensino primário'),
      field('label_ar', 'Libellé arabe', false, 'Libellé arabe facultatif.', 'السنة الأولى ابتدائي'),
      field('country_code', 'Pays', false, 'Code pays ISO 3166-1 alpha-2.', 'SN')
    ]
  },
  campuses: {
    title: 'Campus et sites',
    objective: 'Créer ou mettre à jour les sites physiques ou virtuels.',
    dependencies: [],
    permission: 'institution.write',
    fields: [
      field('code', 'Code du site', true, 'Code stable unique dans l’organisation.', 'DAKAR-CENTRE'),
      field('name', 'Nom', true, 'Nom affiché.', 'Campus Dakar Centre'),
      field('campus_type', 'Type', false, 'Type de site.', 'main-campus', { values: ['main-campus', 'campus', 'annex', 'training-site', 'online'] }),
      field('timezone', 'Fuseau horaire', false, 'Fuseau IANA.', 'Africa/Dakar'),
      field('local_identifier', 'Identifiant local', false, 'Référence administrative locale.', 'SN-DKR-01')
    ]
  },
  people: {
    title: 'Personnes',
    objective: 'Créer ou mettre à jour les identités sans créer automatiquement de compte.',
    dependencies: [],
    permission: 'people.write',
    fields: [
      field('external_id', 'Identifiant externe', true, 'Identifiant stable de la personne dans votre système source.', 'PER-KE-0001'),
      field('given_name', 'Prénom', true, 'Prénom officiel.', 'Amina'),
      field('family_name', 'Nom', true, 'Nom officiel.', 'Mwangi'),
      field('email', 'Courriel', false, 'Courriel principal; unique dans le fichier.', 'amina.mwangi@example.edu'),
      field('phone', 'Téléphone', false, 'Téléphone principal au format international sans préfixe +.', '00254700000001'),
      field('birth_date', 'Date de naissance', false, 'Date ISO AAAA-MM-JJ.', '2012-04-18', { type: 'date' }),
      field('preferred_locale', 'Langue', false, 'Code de langue préféré.', 'en', { values: ['fr', 'en', 'es', 'pt', 'ar'] }),
      field('country_of_citizenship', 'Nationalité', false, 'Code pays ISO alpha-2.', 'KE')
    ]
  },
  learners: {
    title: 'Apprenants',
    objective: 'Créer ou mettre à jour les profils apprenants liés aux personnes.',
    dependencies: ['people'],
    permission: 'academics.write',
    fields: [
      field('person_external_id', 'Personne', true, 'external_id provenant du modèle Personnes.', 'PER-KE-0001'),
      field('learner_number', 'Matricule', true, 'Matricule stable unique dans l’organisation.', 'LRN-2026-0001'),
      field('national_learner_id', 'Identifiant national', false, 'Identifiant apprenant national si applicable.', 'NEMIS-000001')
    ]
  },
  guardians: {
    title: 'Responsables',
    objective: 'Créer ou mettre à jour les profils responsables liés aux personnes.',
    dependencies: ['people'],
    permission: 'profiles.write',
    fields: [
      field('person_external_id', 'Personne', true, 'external_id provenant du modèle Personnes.', 'PER-SN-G001'),
      field('relationship_types', 'Relations', false, `Valeurs séparées par ${LIST_SEPARATOR}.`, 'mother|guardian'),
      field('preferred_contact_channels', 'Canaux', false, `Valeurs séparées par ${LIST_SEPARATOR}.`, 'email|phone')
    ]
  },
  'guardian-links': {
    title: 'Liens responsables-apprenants',
    objective: 'Relier un responsable à un apprenant dans le tenant.',
    dependencies: ['people', 'learners', 'guardians'],
    permission: 'profiles.write',
    fields: [
      field('guardian_person_external_id', 'Responsable', true, 'external_id de la personne responsable.', 'PER-SN-G001'),
      field('learner_person_external_id', 'Apprenant', true, 'external_id de la personne apprenante.', 'PER-KE-0001'),
      field('relationship', 'Relation', true, 'Nature de la relation.', 'mother', { values: ['mother', 'father', 'guardian', 'legal-representative', 'other'] }),
      field('permissions', 'Accès', false, `Permissions séparées par ${LIST_SEPARATOR}.`, 'academic.read|attendance.read')
    ]
  },
  professionals: {
    title: 'Professionnels',
    objective: 'Créer ou mettre à jour les profils professionnels liés aux personnes.',
    dependencies: ['people'],
    permission: 'profiles.write',
    fields: [
      field('person_external_id', 'Personne', true, 'external_id provenant du modèle Personnes.', 'PER-BR-T001'),
      field('professional_type', 'Métier', true, 'Type de professionnel.', 'teacher', { values: ['teacher', 'professor', 'trainer', 'staff'] }),
      field('specialties', 'Spécialités', false, `Valeurs séparées par ${LIST_SEPARATOR}.`, 'mathematics|statistics'),
      field('qualifications', 'Qualifications', false, `Valeurs séparées par ${LIST_SEPARATOR}.`, 'MSc Education')
    ]
  },
  'professional-assignments': {
    title: 'Affectations professionnelles',
    objective: 'Affecter les professionnels à une fonction et éventuellement à un site.',
    dependencies: ['people', 'professionals', 'campuses'],
    permission: 'profiles.write',
    fields: [
      field('professional_person_external_id', 'Professionnel', true, 'external_id de la personne professionnelle.', 'PER-BR-T001'),
      field('campus_code', 'Campus', false, 'Code du site; vide pour une affectation organisationnelle.', 'SAO-PAULO'),
      field('role_title', 'Fonction', true, 'Fonction exercée.', 'teacher'),
      field('employment_type', 'Contrat', false, 'Type de contrat.', 'permanent', { values: ['permanent', 'fixed-term', 'part-time', 'contractor', 'volunteer'] }),
      field('starts_on', 'Début', true, 'Date ISO AAAA-MM-JJ.', '2026-09-01', { type: 'date' }),
      field('ends_on', 'Fin', false, 'Date ISO AAAA-MM-JJ.', '', { type: 'date' })
    ]
  },
  'academic-years': {
    title: 'Années académiques',
    objective: 'Créer ou mettre à jour les années académiques.',
    dependencies: [],
    permission: 'academics.write',
    fields: [
      field('code', 'Code', true, 'Code stable unique dans l’organisation.', '2026-2027'),
      field('name', 'Nom', true, 'Libellé affiché.', 'Année 2026-2027'),
      field('starts_on', 'Début', true, 'Date ISO AAAA-MM-JJ.', '2026-09-01', { type: 'date' }),
      field('ends_on', 'Fin', true, 'Date ISO AAAA-MM-JJ.', '2027-06-30', { type: 'date' }),
      field('calendar_system', 'Calendrier', false, 'Système de calendrier.', 'gregorian')
    ]
  },
  'academic-periods': {
    title: 'Périodes académiques',
    objective: 'Créer ou mettre à jour les périodes d’une année.',
    dependencies: ['academic-years'],
    permission: 'academics.write',
    fields: [
      field('code', 'Code', true, 'Code stable unique dans l’organisation.', '2026-S1'),
      field('name', 'Nom', true, 'Libellé affiché.', 'Semestre 1'),
      field('academic_year_code', 'Année', true, 'Code de l’année académique.', '2026-2027'),
      field('period_type', 'Type', true, 'Type de période.', 'semester', { values: ['semester', 'trimester'] }),
      field('sequence', 'Séquence', true, 'Entier positif unique dans l’année.', '1', { type: 'integer' }),
      field('starts_on', 'Début', true, 'Date ISO AAAA-MM-JJ.', '2026-09-01', { type: 'date' }),
      field('ends_on', 'Fin', true, 'Date ISO AAAA-MM-JJ.', '2027-01-31', { type: 'date' })
    ]
  },
  'academic-levels': {
    title: 'Niveaux académiques',
    objective: 'Créer ou mettre à jour les niveaux locaux.',
    dependencies: [],
    permission: 'academics.write',
    fields: [
      field('code', 'Code', true, 'Code stable unique.', 'PRIMARY-1'),
      field('name', 'Nom', true, 'Libellé affiché.', 'Première année primaire'),
      field('specialization', 'Spécialisation', false, 'Spécialisation facultative.', ''),
      field('credits_required', 'Crédits requis', false, 'Nombre positif ou nul.', '0', { type: 'number' })
    ]
  },
  programs: {
    title: 'Programmes',
    objective: 'Créer ou mettre à jour les programmes d’une année.',
    dependencies: ['academic-years'],
    permission: 'academics.write',
    fields: [
      field('code', 'Code', true, 'Code stable unique.', 'PRI-2026'),
      field('name', 'Nom', true, 'Libellé affiché.', 'Programme primaire'),
      field('academic_year_code', 'Année', true, 'Code de l’année académique.', '2026-2027'),
      field('cycle', 'Cycle', false, 'Cycle académique.', 'primary'),
      field('national_program_code', 'Code national', false, 'Code officiel facultatif.', '')
    ]
  },
  classes: {
    title: 'Classes',
    objective: 'Créer ou mettre à jour les groupes d’enseignement.',
    dependencies: ['academic-years', 'programs', 'academic-levels', 'campuses'],
    permission: 'academics.write',
    fields: [
      field('code', 'Code', true, 'Code stable unique.', 'P1-A-2026'),
      field('name', 'Nom', true, 'Libellé affiché.', 'Primaire 1 A'),
      field('academic_year_code', 'Année', true, 'Code de l’année académique.', '2026-2027'),
      field('program_code', 'Programme', true, 'Code du programme.', 'PRI-2026'),
      field('level_code', 'Niveau', false, 'Code du niveau.', 'PRIMARY-1'),
      field('campus_code', 'Campus', false, 'Code du site.', 'DAKAR-CENTRE')
    ]
  },
  subjects: {
    title: 'Matières',
    objective: 'Créer ou mettre à jour les matières.',
    dependencies: [],
    permission: 'academics.write',
    fields: [
      field('code', 'Code', true, 'Code stable unique.', 'MATH'),
      field('name', 'Nom', true, 'Libellé affiché.', 'Mathématiques'),
      field('description', 'Description', false, 'Description courte.', 'Raisonnement et résolution de problèmes'),
      field('default_credits', 'Crédits', false, 'Nombre positif ou nul.', '4', { type: 'number' })
    ]
  },
  courses: {
    title: 'Cours',
    objective: 'Créer ou mettre à jour les cours rattachés à une matière et une période.',
    dependencies: ['subjects', 'academic-periods', 'classes', 'programs'],
    permission: 'academics.write',
    fields: [
      field('code', 'Code', true, 'Code stable unique.', 'MATH-P1-S1'),
      field('name', 'Nom', true, 'Libellé affiché.', 'Mathématiques P1'),
      field('subject_code', 'Matière', true, 'Code de la matière.', 'MATH'),
      field('academic_period_code', 'Période', true, 'Code de la période académique.', '2026-S1'),
      field('class_code', 'Classe', false, 'Code de classe; classe ou programme est obligatoire.', 'P1-A-2026'),
      field('program_code', 'Programme', false, 'Code programme; classe ou programme est obligatoire.', ''),
      field('credits', 'Crédits', false, 'Nombre positif ou nul.', '4', { type: 'number' })
    ]
  },
  enrollments: {
    title: 'Inscriptions',
    objective: 'Créer ou mettre à jour les inscriptions des apprenants dans les classes.',
    dependencies: ['people', 'learners', 'classes'],
    permission: 'academics.write',
    fields: [
      field('learner_person_external_id', 'Apprenant', true, 'external_id de la personne apprenante.', 'PER-KE-0001'),
      field('class_code', 'Classe', true, 'Code de la classe.', 'P1-A-2026'),
      field('enrollment_reference', 'Référence', false, 'Référence externe de l’inscription.', 'ENR-2026-0001'),
      field('status', 'Statut', false, 'Statut initial.', 'active', { values: ['proposed', 'active', 'withdrawn'] })
    ]
  }
});

const contractHeaders = (contract) => contract.fields.map((item) => item.name);
const trim = (value) => String(value ?? '').trim();
const upper = (value) => trim(value).toUpperCase();
const lower = (value) => trim(value).toLowerCase();
const list = (value) => trim(value) ? trim(value).split(LIST_SEPARATOR).map((item) => item.trim()).filter(Boolean) : [];
const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const csvEscape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;

function rejectFormula(value) {
  const normalized = String(value ?? '').trimStart();
  if (/^[=+@]/.test(normalized) || (/^-/.test(normalized) && !/^-?\d+(?:[.,]\d+)?$/.test(normalized))) {
    throw new ValidationError('Spreadsheet formulas are not accepted in import files.');
  }
  return trim(value);
}

function parseCsvLine(line) {
  const values = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      values.push(rejectFormula(value));
      value = '';
    } else {
      value += character;
    }
  }
  if (quoted) throw new ValidationError('CSV contains an unterminated quoted value.');
  values.push(rejectFormula(value));
  return values;
}

function parseCsv(buffer) {
  if (buffer.includes(0)) throw new ValidationError('CSV must be UTF-8 text.');
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (text.includes('\uFFFD')) throw new ValidationError('CSV must be valid UTF-8.');
  const lines = text.split('\n').filter((line) => line.trim());
  return lines.map(parseCsvLine);
}

function normalizeXlsxCell(cell) {
  const value = cell.value;
  if (cell.type === ExcelJS.ValueType.Formula || (value && typeof value === 'object' && ('formula' in value || 'sharedFormula' in value))) {
    throw new ValidationError('Spreadsheet formulas are not accepted in import files.');
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (value && typeof value === 'object') {
    if (Array.isArray(value.richText)) return rejectFormula(value.richText.map((part) => part.text).join(''));
    if ('text' in value) return rejectFormula(value.text);
    if ('result' in value) return rejectFormula(value.result);
  }
  return rejectFormula(value);
}

function assertSafeXlsxArchive(buffer) {
  let entries = 0;
  let uncompressedBytes = 0;
  for (let offset = 0; offset <= buffer.length - 46; offset += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) continue;
    entries += 1;
    uncompressedBytes += buffer.readUInt32LE(offset + 24);
    if (entries > TEMPLATE_LIMITS.maxZipEntries) {
      throw new ValidationError(`XLSX archive exceeds ${TEMPLATE_LIMITS.maxZipEntries} entries.`);
    }
    if (uncompressedBytes > TEMPLATE_LIMITS.maxUncompressedBytes) {
      throw new ValidationError(`XLSX archive exceeds ${TEMPLATE_LIMITS.maxUncompressedBytes} uncompressed bytes.`);
    }
  }
  if (entries === 0) throw new ValidationError('XLSX archive directory is missing.');
}

async function parseXlsx(buffer) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw new ValidationError('XLSX file is invalid or unsupported.');
  }
  if (workbook.worksheets.length > TEMPLATE_LIMITS.maxWorksheets) {
    throw new ValidationError(`Workbook exceeds ${TEMPLATE_LIMITS.maxWorksheets} worksheets.`);
  }
  let cellCount = 0;
  for (const worksheet of workbook.worksheets) {
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      cellCount += row.cellCount;
      for (let column = 1; column <= row.cellCount; column += 1) normalizeXlsxCell(row.getCell(column));
    });
  }
  if (cellCount > TEMPLATE_LIMITS.maxCells) throw new ValidationError(`Workbook exceeds ${TEMPLATE_LIMITS.maxCells} cells.`);
  const worksheet = workbook.getWorksheet('Données');
  if (!worksheet) throw new ValidationError('Workbook must contain the expected "Données" worksheet.');
  const rows = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const width = row.cellCount;
    if (width > TEMPLATE_LIMITS.maxColumns) throw new ValidationError(`Import exceeds ${TEMPLATE_LIMITS.maxColumns} columns.`);
    rows.push(Array.from({ length: width }, (_, index) => normalizeXlsxCell(row.getCell(index + 1))));
  });
  return rows;
}

function decodeBase64(contentBase64) {
  const source = trim(contentBase64);
  if (!source || !/^[A-Za-z0-9+/]*={0,2}$/.test(source) || source.length % 4 !== 0) {
    throw new ValidationError('contentBase64 must be valid base64.');
  }
  const buffer = Buffer.from(source, 'base64');
  if (buffer.toString('base64').replace(/=+$/, '') !== source.replace(/=+$/, '')) {
    throw new ValidationError('contentBase64 must be valid base64.');
  }
  return buffer;
}

export async function parseContractImport(kind, input) {
  const contract = IMPORT_CONTRACTS[kind];
  if (!contract) throw new ValidationError(`Unsupported import kind: ${kind}.`);
  const fileName = trim(input.fileName);
  const extension = fileName.toLowerCase().split('.').pop();
  if (!['csv', 'xlsx'].includes(extension)) throw new ValidationError('Only .csv and .xlsx files are accepted.');
  const buffer = decodeBase64(input.contentBase64);
  if (!buffer.length) throw new ValidationError('Import file is empty.');
  if (buffer.length > TEMPLATE_LIMITS.maxFileBytes) throw new ValidationError(`Import file exceeds ${TEMPLATE_LIMITS.maxFileBytes} bytes.`);
  const isZip = buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  if (extension === 'xlsx' && !isZip) throw new ValidationError('XLSX signature does not match the file extension.');
  if (extension === 'csv' && isZip) throw new ValidationError('CSV signature does not match the file extension.');
  if (extension === 'xlsx') assertSafeXlsxArchive(buffer);
  const matrix = extension === 'csv' ? parseCsv(buffer) : await parseXlsx(buffer);
  if (matrix.length < 2) throw new ValidationError('Import file must contain a header and at least one data row.');
  if (matrix.length - 1 > TEMPLATE_LIMITS.maxRows) throw new ValidationError(`Import exceeds ${TEMPLATE_LIMITS.maxRows} data rows.`);
  const headers = matrix[0].map((value) => trim(value).replace(/^\uFEFF/, ''));
  const expected = contractHeaders(contract);
  if (headers.length !== expected.length || headers.some((header, index) => header !== expected[index])) {
    throw new ValidationError(`Import headers must exactly match: ${expected.join(',')}.`);
  }
  const invalidWidth = matrix.slice(1).findIndex((values) => values.length !== expected.length);
  if (invalidWidth !== -1) throw new ValidationError(`Import row ${invalidWidth + 2} must contain exactly ${expected.length} cells.`);
  const malformedRow = matrix.slice(1).findIndex((values) => values.length > expected.length);
  if (malformedRow >= 0) {
    throw new ValidationError(`Row ${malformedRow + 2} exceeds the ${expected.length}-column contract.`);
  }
  return {
    buffer,
    digest: createHash('sha256').update(buffer).digest('hex'),
    rows: matrix.slice(1).map((values, index) => ({
      rowNumber: index + 2,
      values: Object.fromEntries(expected.map((header, column) => [header, trim(values[column])]))
    }))
  };
}

function tenantValues(map, organizationId) {
  return [...map.values()].filter((item) => item.organizationId === organizationId && item.status !== 'archived');
}

function personExternalId(person) {
  return trim(person.metadata?.externalId);
}

function findPerson(service, organizationId, externalId) {
  return [...service.people.values()].find((item) =>
    item.primaryOrganizationId === organizationId && personExternalId(item) === externalId
  ) ?? null;
}

function findCode(map, organizationId, code) {
  return tenantValues(map, organizationId).find((item) => item.code === code) ?? null;
}

function addError(errors, rowNumber, fieldName, message) {
  errors.push({ rowNumber, field: fieldName, message });
}

function validateCommon(contract, row, errors) {
  for (const definition of contract.fields) {
    const value = row.values[definition.name];
    if (definition.required && !value) addError(errors, row.rowNumber, definition.name, `${definition.name} is required.`);
    if (value && definition.type === 'date' && !isDate(value)) addError(errors, row.rowNumber, definition.name, `${definition.name} must use YYYY-MM-DD.`);
    if (value && definition.type === 'integer' && (!Number.isInteger(Number(value)) || Number(value) < 1)) addError(errors, row.rowNumber, definition.name, `${definition.name} must be a positive integer.`);
    if (value && definition.type === 'number' && (!Number.isFinite(Number(value)) || Number(value) < 0)) addError(errors, row.rowNumber, definition.name, `${definition.name} must be a non-negative number.`);
    if (value && definition.values && !definition.values.includes(value)) addError(errors, row.rowNumber, definition.name, `${definition.name} must be one of: ${definition.values.join(', ')}.`);
  }
}

function validateRows(service, organizationId, kind, parsed) {
  const contract = IMPORT_CONTRACTS[kind];
  const errors = [];
  const unique = new Set();
  const emails = new Set();
  for (const row of parsed.rows) {
    validateCommon(contract, row, errors);
    const value = row.values;
    const uniqueKey = ({
      references: `${lower(value.catalog)}:${upper(value.code)}`,
      people: value.external_id,
      learners: value.learner_number,
      guardians: value.person_external_id,
      'guardian-links': `${value.guardian_person_external_id}:${value.learner_person_external_id}`,
      professionals: value.person_external_id,
      'professional-assignments': `${value.professional_person_external_id}:${value.campus_code}:${value.role_title}:${value.starts_on}`,
      enrollments: `${value.learner_person_external_id}:${value.class_code}`
    })[kind] ?? value.code;
    if (unique.has(uniqueKey)) addError(errors, row.rowNumber, Object.keys(value)[0], 'Stable identifier is duplicated in this file.');
    unique.add(uniqueKey);
    if (kind === 'references' && !value.label_fr && !value.label_en) addError(errors, row.rowNumber, 'label_fr', 'label_fr or label_en is required.');
    if (kind === 'people') {
      if (value.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.email)) addError(errors, row.rowNumber, 'email', 'email is invalid.');
      const email = lower(value.email);
      if (email && emails.has(email)) addError(errors, row.rowNumber, 'email', 'email is duplicated in this file.');
      if (email) emails.add(email);
      const existingPerson = findPerson(service, organizationId, value.external_id);
      const emailOwner = email && [...service.people.values()].find((person) =>
        person.primaryOrganizationId === organizationId
        && person.id !== existingPerson?.id
        && person.contacts.some((contact) => contact.type === 'email' && lower(contact.value) === email)
      );
      if (emailOwner) addError(errors, row.rowNumber, 'email', 'email belongs to another person in this tenant.');
      if (value.country_of_citizenship && !/^[A-Za-z]{2}$/.test(value.country_of_citizenship)) addError(errors, row.rowNumber, 'country_of_citizenship', 'country_of_citizenship must be a two-letter country code.');
    }
    const personFields = ['person_external_id', 'guardian_person_external_id', 'learner_person_external_id', 'professional_person_external_id'];
    for (const fieldName of personFields) {
      if (value[fieldName] && !findPerson(service, organizationId, value[fieldName])) addError(errors, row.rowNumber, fieldName, `Unknown tenant person external reference: ${value[fieldName]}.`);
    }
    const references = [
      ['academic_year_code', service.academicYears],
      ['program_code', service.programs],
      ['class_code', service.classes],
      ['campus_code', service.campuses],
      ['subject_code', service.subjects],
      ['academic_period_code', service.academicPeriods],
      ['level_code', service.academicLevels]
    ];
    for (const [fieldName, map] of references) {
      if (value[fieldName] && !findCode(map, organizationId, value[fieldName])) addError(errors, row.rowNumber, fieldName, `Unknown tenant code: ${value[fieldName]}.`);
    }
    if (kind === 'learners') {
      const person = findPerson(service, organizationId, value.person_external_id);
      const conflict = tenantValues(service.learners, organizationId).find((item) => item.learnerNumber === value.learner_number && item.personId !== person?.id);
      if (conflict) addError(errors, row.rowNumber, 'learner_number', 'learner_number belongs to another person.');
    }
    if (kind === 'guardian-links') {
      const guardianPerson = findPerson(service, organizationId, value.guardian_person_external_id);
      const learnerPerson = findPerson(service, organizationId, value.learner_person_external_id);
      if (guardianPerson && !tenantValues(service.guardianProfiles, organizationId).some((item) => item.personId === guardianPerson.id)) addError(errors, row.rowNumber, 'guardian_person_external_id', 'Referenced person has no guardian profile.');
      if (learnerPerson && !tenantValues(service.learners, organizationId).some((item) => item.personId === learnerPerson.id)) addError(errors, row.rowNumber, 'learner_person_external_id', 'Referenced person has no learner profile.');
    }
    if (kind === 'professional-assignments') {
      const person = findPerson(service, organizationId, value.professional_person_external_id);
      if (person && !tenantValues(service.professionalProfiles, organizationId).some((item) => item.personId === person.id)) addError(errors, row.rowNumber, 'professional_person_external_id', 'Referenced person has no professional profile.');
    }
    if (kind === 'academic-years' && value.starts_on && value.ends_on && Date.parse(value.ends_on) <= Date.parse(value.starts_on)) addError(errors, row.rowNumber, 'ends_on', 'ends_on must be after starts_on.');
    if (kind === 'academic-periods') {
      const year = findCode(service.academicYears, organizationId, value.academic_year_code);
      if (year && value.starts_on && value.ends_on && (Date.parse(value.starts_on) < Date.parse(year.startsOn) || Date.parse(value.ends_on) > Date.parse(year.endsOn))) addError(errors, row.rowNumber, 'starts_on', 'Period dates must be contained within the academic year.');
    }
    if (kind === 'classes') {
      const year = findCode(service.academicYears, organizationId, value.academic_year_code);
      const program = findCode(service.programs, organizationId, value.program_code);
      if (year && program && program.academicYearId !== year.id) addError(errors, row.rowNumber, 'program_code', 'program_code must belong to academic_year_code.');
    }
    if (kind === 'courses') {
      const period = findCode(service.academicPeriods, organizationId, value.academic_period_code);
      const learningClass = value.class_code ? findCode(service.classes, organizationId, value.class_code) : null;
      const program = value.program_code ? findCode(service.programs, organizationId, value.program_code) : null;
      if (period && learningClass && learningClass.academicYearId !== period.academicYearId) addError(errors, row.rowNumber, 'class_code', 'class_code and academic_period_code must belong to the same academic year.');
      if (period && program && program.academicYearId !== period.academicYearId) addError(errors, row.rowNumber, 'program_code', 'program_code and academic_period_code must belong to the same academic year.');
    }
    if (kind === 'courses' && !value.class_code && !value.program_code) addError(errors, row.rowNumber, 'class_code', 'class_code or program_code is required.');
  }
  return errors;
}

function save(service, collection, entity, existing, changes, actorId, action) {
  if (existing) {
    const before = structuredClone(existing);
    const changed = Object.entries(changes).some(([key, value]) =>
      JSON.stringify(existing[key] ?? null) !== JSON.stringify(value ?? null)
    );
    if (!changed) return { entity: existing, outcome: 'ignored' };
    for (const [key, value] of Object.entries(existing)) {
      if (!(key in changes)) entity[key] = structuredClone(value);
    }
    entity.id = existing.id;
    entity.createdAt = existing.createdAt;
    entity.updatedAt = new Date();
    service[collection].set(entity.id, entity);
    service.recordUpdate(collection, before, entity, actorId, `${action}.update`);
    return { entity, outcome: 'updated' };
  }
  service[collection].set(entity.id, entity);
  service.recordCreate(collection, entity, actorId, `${action}.create`);
  return { entity, outcome: 'created' };
}

function applyRow(service, organizationId, kind, value, actorId) {
  if (kind === 'references') {
    const catalog = lower(value.catalog);
    const code = upper(value.code);
    const existing = tenantValues(service.referenceEntries, organizationId).find((item) => item.catalog === catalog && item.code === code);
    const changes = {
      labels: {
        ...(existing?.labels ?? {}),
        ...(value.label_fr ? { fr: value.label_fr } : {}),
        ...(value.label_en ? { en: value.label_en } : {}),
        ...(value.label_es ? { es: value.label_es } : {}),
        ...(value.label_pt ? { pt: value.label_pt } : {}),
        ...(value.label_ar ? { ar: value.label_ar } : {})
      },
      countryCode: upper(value.country_code) || null
    };
    return save(service, 'referenceEntries', new ReferenceEntry({ organizationId, catalog, code, ...changes, standard: false }), existing, changes, actorId, 'reference.import');
  }
  if (kind === 'campuses') {
    const existing = findCode(service.campuses, organizationId, value.code);
    const changes = { name: value.name, campusType: value.campus_type || 'campus', timezone: value.timezone || null, localIdentifier: value.local_identifier || null };
    return save(service, 'campuses', new Campus({ organizationId, code: value.code, ...changes }), existing, changes, actorId, 'campus.import');
  }
  if (kind === 'people') {
    const existing = findPerson(service, organizationId, value.external_id);
    const contacts = [
      ...(value.email ? [{ type: 'email', value: lower(value.email), isPrimary: true, verifiedAt: null }] : []),
      ...(value.phone ? [{ type: 'phone', value: value.phone, isPrimary: !value.email, verifiedAt: null }] : [])
    ];
    const changes = { givenName: value.given_name, familyName: value.family_name, birthDate: value.birth_date || null, preferredLocale: value.preferred_locale || null, countryOfCitizenship: upper(value.country_of_citizenship) || null, contacts, metadata: { ...(existing?.metadata ?? {}), externalId: value.external_id } };
    return save(service, 'people', new Person({ primaryOrganizationId: organizationId, ...changes }), existing, changes, actorId, 'person.import');
  }
  if (kind === 'learners') {
    const person = findPerson(service, organizationId, value.person_external_id);
    const existing = tenantValues(service.learners, organizationId).find((item) => item.personId === person.id);
    const changes = { learnerNumber: value.learner_number, nationalLearnerId: value.national_learner_id || null };
    return save(service, 'learners', new Learner({ organizationId, personId: person.id, ...changes }), existing, changes, actorId, 'learner.import');
  }
  if (kind === 'guardians') {
    const person = findPerson(service, organizationId, value.person_external_id);
    const existing = tenantValues(service.guardianProfiles, organizationId).find((item) => item.personId === person.id);
    const changes = { relationshipTypes: list(value.relationship_types), preferredContactChannels: list(value.preferred_contact_channels) };
    return save(service, 'guardianProfiles', new GuardianProfile({ organizationId, personId: person.id, ...changes }), existing, changes, actorId, 'guardian.import');
  }
  if (kind === 'guardian-links') {
    const guardianPerson = findPerson(service, organizationId, value.guardian_person_external_id);
    const learnerPerson = findPerson(service, organizationId, value.learner_person_external_id);
    const guardian = tenantValues(service.guardianProfiles, organizationId).find((item) => item.personId === guardianPerson.id);
    const learner = tenantValues(service.learners, organizationId).find((item) => item.personId === learnerPerson.id);
    const existing = tenantValues(service.guardianLearnerRelations, organizationId).find((item) => item.guardianProfileId === guardian.id && item.learnerId === learner.id);
    const changes = { relationship: value.relationship, permissions: list(value.permissions) };
    return save(service, 'guardianLearnerRelations', new GuardianLearnerRelation({ organizationId, guardianProfileId: guardian.id, learnerId: learner.id, ...changes }), existing, changes, actorId, 'guardian-link.import');
  }
  if (kind === 'professionals') {
    const person = findPerson(service, organizationId, value.person_external_id);
    const existing = tenantValues(service.professionalProfiles, organizationId).find((item) => item.personId === person.id);
    const changes = { professionalType: value.professional_type, specialties: list(value.specialties), qualifications: list(value.qualifications), assignmentOrganizationIds: [organizationId] };
    return save(service, 'professionalProfiles', new ProfessionalProfile({ organizationId, personId: person.id, ...changes }), existing, changes, actorId, 'professional.import');
  }
  if (kind === 'professional-assignments') {
    const person = findPerson(service, organizationId, value.professional_person_external_id);
    const professional = tenantValues(service.professionalProfiles, organizationId).find((item) => item.personId === person.id);
    const campus = value.campus_code ? findCode(service.campuses, organizationId, value.campus_code) : null;
    const existing = tenantValues(service.professionalAssignments, organizationId).find((item) => item.professionalProfileId === professional.id && (item.campusId ?? null) === (campus?.id ?? null) && item.roleTitle === value.role_title && item.startsOn === value.starts_on);
    const changes = { employmentType: value.employment_type || null, endsOn: value.ends_on || null };
    return save(service, 'professionalAssignments', new ProfessionalAssignment({ organizationId, professionalProfileId: professional.id, campusId: campus?.id ?? null, roleTitle: value.role_title, startsOn: value.starts_on, ...changes }), existing, changes, actorId, 'professional-assignment.import');
  }
  if (kind === 'academic-years') {
    const existing = findCode(service.academicYears, organizationId, value.code);
    const changes = { name: value.name, startsOn: value.starts_on, endsOn: value.ends_on, calendarSystem: value.calendar_system || 'gregorian' };
    return save(service, 'academicYears', new AcademicYear({ organizationId, code: value.code, ...changes }), existing, changes, actorId, 'academic-year.import');
  }
  if (kind === 'academic-periods') {
    const year = findCode(service.academicYears, organizationId, value.academic_year_code);
    const existing = findCode(service.academicPeriods, organizationId, value.code);
    const changes = { name: value.name, academicYearId: year.id, periodType: value.period_type, sequence: Number(value.sequence), startsOn: value.starts_on, endsOn: value.ends_on };
    return save(service, 'academicPeriods', new AcademicPeriod({ organizationId, code: value.code, ...changes }), existing, changes, actorId, 'academic-period.import');
  }
  if (kind === 'academic-levels') {
    const existing = findCode(service.academicLevels, organizationId, value.code);
    const changes = { name: value.name, specialization: value.specialization || null, creditsRequired: Number(value.credits_required || 0) };
    return save(service, 'academicLevels', new AcademicLevel({ organizationId, code: value.code, ...changes }), existing, changes, actorId, 'academic-level.import');
  }
  if (kind === 'programs') {
    const year = findCode(service.academicYears, organizationId, value.academic_year_code);
    const existing = findCode(service.programs, organizationId, value.code);
    const changes = { name: value.name, academicYearId: year.id, cycle: value.cycle || null, nationalProgramCode: value.national_program_code || null };
    return save(service, 'programs', new Program({ organizationId, code: value.code, ...changes }), existing, changes, actorId, 'program.import');
  }
  if (kind === 'classes') {
    const year = findCode(service.academicYears, organizationId, value.academic_year_code);
    const program = findCode(service.programs, organizationId, value.program_code);
    const campus = value.campus_code ? findCode(service.campuses, organizationId, value.campus_code) : null;
    const existing = findCode(service.classes, organizationId, value.code);
    const changes = { name: value.name, academicYearId: year.id, programId: program.id, levelCode: value.level_code || null, campusId: campus?.id ?? null };
    return save(service, 'classes', new LearningClass({ organizationId, code: value.code, ...changes }), existing, changes, actorId, 'class.import');
  }
  if (kind === 'subjects') {
    const existing = findCode(service.subjects, organizationId, value.code);
    const changes = { name: value.name, description: value.description || null, defaultCredits: Number(value.default_credits || 0) };
    return save(service, 'subjects', new Subject({ organizationId, code: value.code, ...changes }), existing, changes, actorId, 'subject.import');
  }
  if (kind === 'courses') {
    const subject = findCode(service.subjects, organizationId, value.subject_code);
    const period = findCode(service.academicPeriods, organizationId, value.academic_period_code);
    const learningClass = value.class_code ? findCode(service.classes, organizationId, value.class_code) : null;
    const program = value.program_code ? findCode(service.programs, organizationId, value.program_code) : null;
    const existing = findCode(service.courses, organizationId, value.code);
    const changes = { name: value.name, subjectId: subject.id, academicPeriodId: period.id, classId: learningClass?.id ?? null, programId: program?.id ?? null, credits: Number(value.credits || 0), teacherAssignmentIds: [] };
    return save(service, 'courses', new Course({ organizationId, code: value.code, ...changes }), existing, changes, actorId, 'course.import');
  }
  if (kind === 'enrollments') {
    const person = findPerson(service, organizationId, value.learner_person_external_id);
    const learner = tenantValues(service.learners, organizationId).find((item) => item.personId === person.id);
    const learningClass = findCode(service.classes, organizationId, value.class_code);
    const existing = tenantValues(service.enrollments, organizationId).find((item) => item.learnerId === learner.id && item.classId === learningClass.id);
    const changes = { enrollmentReference: value.enrollment_reference || null, status: value.status || 'active' };
    return save(service, 'enrollments', new Enrollment({ organizationId, personId: person.id, learnerId: learner.id, classId: learningClass.id, academicYearId: learningClass.academicYearId, programId: learningClass.programId, ...changes }), existing, changes, actorId, 'enrollment.import');
  }
  throw new ValidationError(`Unsupported import kind: ${kind}.`);
}

export async function executeContractImport(service, input, actorId) {
  const organizationId = input.organizationId;
  service.assertOrganizationContext(organizationId);
  const parsed = await parseContractImport(input.kind, input);
  const errors = validateRows(service, organizationId, input.kind, parsed);
  const invalidRows = new Set(errors.map((error) => error.rowNumber));
  const summary = { total: parsed.rows.length, valid: parsed.rows.length - invalidRows.size, created: 0, updated: 0, ignored: 0, invalid: invalidRows.size };
  const previewRows = parsed.rows.map((row) => ({ ...row, errors: errors.filter((error) => error.rowNumber === row.rowNumber) }));
  if (input.dryRun !== false) return { dryRun: true, kind: input.kind, contract: IMPORT_CONTRACTS[input.kind], summary, rows: previewRows, errors };
  if (errors.length) throw new ValidationError('Import contains invalid rows. Correct every error before applying.');
  if (!input.confirmed) throw new ValidationError('confirmed must be true before applying an import.');
  const idempotencyKey = trim(input.idempotencyKey);
  if (!idempotencyKey) throw new ValidationError('idempotencyKey is required when applying an import.');
  const existingBatch = [...service.importBatches.values()].find((item) => item.organizationId === organizationId && item.idempotencyKey === idempotencyKey);
  if (existingBatch) {
    if (existingBatch.fileDigest !== parsed.digest || existingBatch.kind !== input.kind) throw new ValidationError('idempotencyKey was already used for a different import.');
    return { ...existingBatch.result, replayed: true };
  }
  const mutableCollections = ['referenceEntries', 'campuses', 'people', 'learners', 'guardianProfiles', 'guardianLearnerRelations', 'professionalProfiles', 'professionalAssignments', 'academicYears', 'academicPeriods', 'academicLevels', 'programs', 'classes', 'subjects', 'courses', 'enrollments', 'importBatches'];
  const snapshots = Object.fromEntries(mutableCollections.map((name) => [name, new Map(service[name])]));
  try {
    return await service.transactional(() => {
      const rows = parsed.rows.map((row) => {
        const applied = applyRow(service, organizationId, input.kind, row.values, actorId);
        summary[applied.outcome] += 1;
        return { rowNumber: row.rowNumber, outcome: applied.outcome, entityId: applied.entity.id };
      });
      const batchId = createPermanentId();
      const result = { dryRun: false, batchId, kind: input.kind, summary, rows, errors: [], replayed: false };
      const now = new Date().toISOString();
      const batch = { id: batchId, organizationId, idempotencyKey, fileDigest: parsed.digest, fileName: input.fileName, kind: input.kind, status: 'applied', result, createdAt: now, updatedAt: now };
      service.importBatches.set(batch.id, batch);
      service.recordCreate('importBatches', batch, actorId, 'bulk-import.apply');
      return result;
    });
  } catch (error) {
    for (const [name, snapshot] of Object.entries(snapshots)) service[name] = snapshot;
    throw error;
  }
}

export function createCsvTemplate(kind) {
  const contract = IMPORT_CONTRACTS[kind];
  if (!contract) throw new ValidationError(`Unsupported import kind: ${kind}.`);
  return `\uFEFF${contractHeaders(contract).map(csvEscape).join(',')}\r\n${contract.fields.map((item) => csvEscape(item.example)).join(',')}\r\n`;
}

function styleHeader(row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
  row.alignment = { vertical: 'middle' };
}

function addContractWorksheet(workbook, kind, contract, name = 'Données') {
  const worksheet = workbook.addWorksheet(name);
  const headers = contractHeaders(contract);
  worksheet.addRow(headers);
  worksheet.addRow(contract.fields.map((item) => item.example));
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  styleHeader(worksheet.getRow(1));
  contract.fields.forEach((definition, index) => {
    const column = worksheet.getColumn(index + 1);
    column.width = Math.min(48, Math.max(16, definition.name.length + 4, definition.example.length + 4));
    column.numFmt = TEXT_FORMAT;
    if (definition.values) {
      for (let row = 2; row <= TEMPLATE_LIMITS.maxRows + 1; row += 1) {
        worksheet.getCell(row, index + 1).dataValidation = {
          type: 'list',
          allowBlank: !definition.required,
          formulae: [`"${definition.values.join(',')}"`],
          showErrorMessage: true,
          errorTitle: 'Valeur invalide',
          error: `Valeurs autorisées: ${definition.values.join(', ')}`
        };
      }
    }
  });
  worksheet.name = name;
  worksheet.properties.tabColor = { argb: 'FF70AD47' };
  worksheet.getCell('A1').note = `Modèle ${kind}. Ne modifiez ni l’ordre ni le nom des colonnes.`;
  return worksheet;
}

function addInstructions(workbook, title, objective, dependencies) {
  const sheet = workbook.addWorksheet('Instructions');
  sheet.columns = [{ width: 28 }, { width: 90 }];
  sheet.addRows([
    ['Modèle', title],
    ['Objectif', objective],
    ['Encodage CSV', 'UTF-8 avec BOM; séparateur virgule; valeurs entre guillemets.'],
    ['Références', 'Utilisez external_id et les codes stables; aucun UUID de la plateforme n’est requis.'],
    ['Dépendances', dependencies.length ? dependencies.join(' → ') : 'Aucune'],
    ['Import', 'Importez la feuille Données. Un dry-run sans écriture précède toute application.'],
    ['Sécurité', 'Les formules et en-têtes modifiés sont refusés.']
  ]);
  sheet.getColumn(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

function addDictionary(workbook, contract) {
  const sheet = workbook.addWorksheet('Dictionnaire');
  sheet.columns = [
    { header: 'Colonne', key: 'name', width: 32 },
    { header: 'Libellé', key: 'label', width: 28 },
    { header: 'Obligatoire', key: 'required', width: 14 },
    { header: 'Description', key: 'description', width: 70 },
    { header: 'Exemple', key: 'example', width: 30 },
    { header: 'Valeurs autorisées', key: 'values', width: 48 }
  ];
  styleHeader(sheet.getRow(1));
  for (const definition of contract.fields) {
    sheet.addRow({ ...definition, required: definition.required ? 'oui' : 'non', values: definition.values?.join(LIST_SEPARATOR) ?? '' });
  }
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = 'A1:F1';
}

function addReferences(workbook, contract) {
  const constrained = contract.fields.filter((item) => item.values);
  if (!constrained.length) return;
  const sheet = workbook.addWorksheet('Références');
  sheet.columns = [{ header: 'Colonne', width: 34 }, { header: 'Valeur autorisée', width: 50 }];
  styleHeader(sheet.getRow(1));
  for (const definition of constrained) {
    for (const value of definition.values) sheet.addRow([definition.name, value]);
  }
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

export async function createXlsxTemplate(kind) {
  const contract = IMPORT_CONTRACTS[kind];
  if (!contract) throw new ValidationError(`Unsupported import kind: ${kind}.`);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Eduplateforme';
  workbook.created = new Date(0);
  addInstructions(workbook, contract.title, contract.objective, contract.dependencies);
  addContractWorksheet(workbook, kind, contract);
  addDictionary(workbook, contract);
  addReferences(workbook, contract);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function createXlsxPack() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Eduplateforme';
  workbook.created = new Date(0);
  addInstructions(workbook, 'Pack complet des imports', 'Préparer un établissement relationnel complet.', Object.keys(IMPORT_CONTRACTS));
  for (const [kind, contract] of Object.entries(IMPORT_CONTRACTS)) {
    addContractWorksheet(workbook, kind, contract, kind.slice(0, 31));
  }
  const dictionary = workbook.addWorksheet('Dictionnaire');
  dictionary.columns = [{ header: 'Modèle', width: 30 }, { header: 'Colonne', width: 34 }, { header: 'Obligatoire', width: 14 }, { header: 'Description', width: 70 }];
  styleHeader(dictionary.getRow(1));
  for (const [kind, contract] of Object.entries(IMPORT_CONTRACTS)) {
    for (const definition of contract.fields) dictionary.addRow([kind, definition.name, definition.required ? 'oui' : 'non', definition.description]);
  }
  dictionary.views = [{ state: 'frozen', ySplit: 1 }];
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function publicImportCatalog() {
  return Object.entries(IMPORT_CONTRACTS).map(([kind, contract]) => ({
    kind,
    title: contract.title,
    objective: contract.objective,
    dependencies: contract.dependencies,
    columns: contractHeaders(contract),
    fields: contract.fields,
    formats: ['csv', 'xlsx']
  }));
}
