import { createHash, randomBytes } from 'node:crypto';

import ExcelJS from 'exceljs';

import { FoundationService } from '../application/foundation-service.js';
import { Role } from '../domain/authorization/authorization.js';
import {
  GuardianLearnerRelation,
  GuardianProfile,
  ProfessionalAssignment,
  ProfessionalProfile
} from '../domain/institutional/institutional.js';
import { ReferenceEntry } from '../domain/learning-systems/learning-systems.js';
import { createPermanentId, ValidationError } from '../shared/entity.js';

export const IMPORT_LIMITS = Object.freeze({
  maxFileBytes: 5 * 1024 * 1024,
  maxRows: 1000,
  maxColumns: 20
});

export const IMPORT_SCHEMAS = Object.freeze({
  people: ['personType', 'givenName', 'familyName', 'email', 'phone', 'learnerNumber', 'gradeLevel', 'classCode', 'guardianGivenName', 'guardianFamilyName', 'guardianEmail', 'relationship', 'professionalType', 'roleTitle', 'startsOn', 'campusCode', 'createAccount', 'accountPolicy'],
  learners: ['givenName', 'familyName', 'email', 'learnerNumber', 'classCode', 'createAccount'],
  'class-roster': ['givenName', 'familyName', 'email', 'learnerNumber', 'createAccount'],
  staff: ['givenName', 'familyName', 'email', 'professionalType', 'roleTitle', 'startsOn', 'campusCode', 'createAccount']
  ,
  references: ['catalog', 'code', 'labelFr', 'labelEn', 'labelEs', 'labelPt', 'labelAr', 'countryCode']
});

function normalizeHeader(value) {
  return String(value ?? '').trim().replace(/^\uFEFF/, '');
}

function normalizeCell(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if ('formula' in value || 'sharedFormula' in value) {
      throw new ValidationError('Spreadsheet formulas are not accepted in import files.');
    }
    if ('text' in value) return String(value.text).trim();
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text).join('').trim();
    if ('result' in value) return normalizeCell(value.result);
  }
  return String(value).trim();
}

function rejectCsvFormula(value) {
  const trimmed = String(value ?? '').trimStart();
  if (/^[=+@]/.test(trimmed) || (/^-/.test(trimmed) && !/^-?\d+(?:[.,]\d+)?$/.test(trimmed))) {
    throw new ValidationError('Spreadsheet formulas are not accepted in import files.');
  }
  return String(value ?? '').trim();
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      values.push(rejectCsvFormula(current));
      current = '';
    } else {
      current += character;
    }
  }
  if (quoted) throw new ValidationError('CSV contains an unterminated quoted value.');
  values.push(rejectCsvFormula(current));
  return values;
}

function parseCsv(buffer) {
  const text = buffer.toString('utf8').replace(/\r\n?/g, '\n');
  const lines = text.split('\n').filter((line) => line.trim() !== '');
  if (lines.length === 0) throw new ValidationError('Import file is empty.');
  return lines.map(parseCsvLine);
}

async function parseXlsx(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new ValidationError('Workbook does not contain a worksheet.');
  const rows = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    if (row.cellCount > IMPORT_LIMITS.maxColumns) {
      throw new ValidationError(`Import file exceeds ${IMPORT_LIMITS.maxColumns} columns.`);
    }
    const values = [];
    const width = row.cellCount;
    for (let column = 1; column <= width; column += 1) {
      values.push(normalizeCell(row.getCell(column).value));
    }
    rows.push(values);
  });
  return rows;
}

export async function parseImportFile({ fileName, contentBase64 }) {
  if (!fileName || !contentBase64) throw new ValidationError('fileName and contentBase64 are required.');
  const extension = String(fileName).toLowerCase().split('.').pop();
  if (!['csv', 'xlsx'].includes(extension)) throw new ValidationError('Only .csv and .xlsx files are accepted.');
  const buffer = Buffer.from(contentBase64, 'base64');
  if (buffer.length === 0) throw new ValidationError('Import file is empty.');
  if (buffer.length > IMPORT_LIMITS.maxFileBytes) {
    throw new ValidationError(`Import file exceeds ${IMPORT_LIMITS.maxFileBytes} bytes.`);
  }
  const rows = extension === 'csv' ? parseCsv(buffer) : await parseXlsx(buffer);
  if (rows.length < 2) throw new ValidationError('Import file must contain a header and at least one data row.');
  if (rows.length - 1 > IMPORT_LIMITS.maxRows) {
    throw new ValidationError(`Import file exceeds ${IMPORT_LIMITS.maxRows} data rows.`);
  }
  if (rows.some((row) => row.length > IMPORT_LIMITS.maxColumns)) {
    throw new ValidationError(`Import file exceeds ${IMPORT_LIMITS.maxColumns} columns.`);
  }
  const headers = rows[0].map(normalizeHeader);
  if (new Set(headers).size !== headers.length) throw new ValidationError('Import headers must be unique.');
  return {
    headers,
    rows: rows.slice(1).map((values, index) => ({
      rowNumber: index + 2,
      values: Object.fromEntries(headers.map((header, column) => [header, normalizeCell(values[column])]))
    })),
    digest: createHash('sha256').update(buffer).digest('hex')
  };
}

function parseBoolean(value) {
  return ['1', 'true', 'yes', 'oui', 'sim'].includes(String(value ?? '').trim().toLowerCase());
}

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

function findPersonByEmail(service, organizationId, email) {
  if (!email) return null;
  return [...service.people.values()].find((person) =>
    person.primaryOrganizationId === organizationId
    && person.contacts.some((contact) => contact.type === 'email' && contact.value.toLowerCase() === email)
  ) ?? null;
}

function validateRows(service, { organizationId, kind, classId, parsed }) {
  const schema = IMPORT_SCHEMAS[kind];
  if (!schema) throw new ValidationError(`Unsupported import kind: ${kind}.`);
  const missingHeaders = schema.filter((header) => !parsed.headers.includes(header));
  if (missingHeaders.length > 0) throw new ValidationError(`Missing import columns: ${missingHeaders.join(', ')}.`);

  const fixedClass = classId ? service.classes.get(classId) : null;
  if (classId && (!fixedClass || fixedClass.organizationId !== organizationId)) {
    throw new ValidationError('Selected class does not belong to the active organization.');
  }
  if (kind === 'class-roster' && !fixedClass) throw new ValidationError('classId is required for class-roster imports.');

  const seenEmails = new Set();
  const seenIdentifiers = new Set();
  return parsed.rows.map(({ rowNumber, values }) => {
    const errors = [];
    if (kind === 'references') {
      const catalog = String(values.catalog ?? '').trim().toLowerCase();
      const code = String(values.code ?? '').trim().toUpperCase();
      if (!catalog) errors.push('catalog is required');
      if (!code) errors.push('code is required');
      if (!values.labelFr && !values.labelEn) errors.push('labelFr or labelEn is required');
      const duplicateKey = `${catalog}:${code}`;
      if (seenIdentifiers.has(duplicateKey)) errors.push('catalog and code are duplicated in this file');
      seenIdentifiers.add(duplicateKey);
      return {
        rowNumber,
        kind,
        values: {
          ...values,
          catalog,
          code,
          countryCode: String(values.countryCode ?? '').trim().toUpperCase() || null,
          labels: Object.fromEntries([
            ['fr', values.labelFr], ['en', values.labelEn], ['es', values.labelEs],
            ['pt', values.labelPt], ['ar', values.labelAr]
          ].filter(([, label]) => String(label ?? '').trim()).map(([locale, label]) => [locale, String(label).trim()]))
        },
        errors
      };
    }
    const givenName = String(values.givenName ?? '').trim();
    const familyName = String(values.familyName ?? '').trim();
    const email = normalizeEmail(values.email);
    if (!givenName) errors.push('givenName is required');
    if (!familyName) errors.push('familyName is required');
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push('email is invalid');
    if (email && seenEmails.has(email)) errors.push('email is duplicated in this file');
    if (email) seenEmails.add(email);
    const accountForEmail = email
      ? [...service.accounts.values()].find((item) => item.email === email)
      : null;
    if (accountForEmail && !accountForEmail.organizationIds.includes(organizationId)) {
      errors.push('email belongs to an account in another organization');
    }

    const unifiedType = kind === 'people' ? String(values.personType ?? '').trim().toLowerCase() : null;
    if (kind === 'people' && !['learner', 'student', 'trainee', 'guardian', 'parent', 'teacher', 'trainer', 'staff'].includes(unifiedType)) {
      errors.push('personType must be learner, student, trainee, guardian, parent, teacher, trainer or staff');
    }
    const isStaff = kind === 'staff' || ['teacher', 'trainer', 'staff'].includes(unifiedType);
    const isGuardianOnly = kind === 'people' && ['guardian', 'parent'].includes(unifiedType);
    if (isStaff) {
      const professionalType = String(values.professionalType ?? '').toLowerCase();
      const resolvedProfessionalType = professionalType || unifiedType;
      if (!['teacher', 'trainer', 'professor', 'staff'].includes(resolvedProfessionalType)) {
        errors.push('professionalType must be teacher, trainer, professor or staff');
      }
      if (!values.roleTitle) errors.push('roleTitle is required');
      if (!values.startsOn || Number.isNaN(Date.parse(values.startsOn))) errors.push('startsOn must be a valid date');
      const campus = values.campusCode
        ? [...service.campuses.values()].find((item) =>
          item.organizationId === organizationId && item.code === values.campusCode && item.status !== 'archived'
        )
        : null;
      if (values.campusCode && !campus) errors.push(`unknown campusCode: ${values.campusCode}`);
      if (parseBoolean(values.createAccount) && !email) errors.push('email is required for a staff account');
      return {
        rowNumber, kind, values: { ...values, personType: unifiedType || 'staff', givenName, familyName, email, professionalType: resolvedProfessionalType, campusId: campus?.id ?? null, createAccount: parseBoolean(values.createAccount) },
        errors
      };
    }
    if (isGuardianOnly) {
      if (parseBoolean(values.createAccount) && !email) errors.push('email is required for a standalone guardian account');
      return {
        rowNumber,
        kind,
        values: { ...values, personType: unifiedType, givenName, familyName, email, createAccount: parseBoolean(values.createAccount) },
        errors
      };
    }

    const learnerNumber = String(values.learnerNumber ?? '').trim();
    if (!learnerNumber) errors.push('learnerNumber is required');
    if (learnerNumber && seenIdentifiers.has(learnerNumber)) errors.push('learnerNumber is duplicated in this file');
    if (learnerNumber) seenIdentifiers.add(learnerNumber);
    const targetClass = fixedClass ?? [...service.classes.values()].find((item) =>
      item.organizationId === organizationId && item.code === values.classCode && item.status !== 'archived'
    );
    if (!targetClass) errors.push(`unknown class: ${values.classCode || classId || '(missing)'}`);
    const existingLearner = [...service.learners.values()].find((item) =>
      item.organizationId === organizationId && item.learnerNumber === learnerNumber
    );
    const person = findPersonByEmail(service, organizationId, email);
    if (existingLearner && person && existingLearner.personId !== person.id) {
      errors.push('learnerNumber and email identify different people');
    }
    const gradeLevel = String(values.gradeLevel ?? '').trim().toLowerCase();
    let accountPolicy = String(values.accountPolicy ?? '').trim().toLowerCase();
    const gradeNumber = Number.parseInt(gradeLevel.replace(/\D/g, ''), 10);
    const earlyGrade = /pre|preschool|kindergarten|maternelle/.test(gradeLevel)
      || (Number.isInteger(gradeNumber) && gradeNumber >= 1 && gradeNumber <= 4);
    if (!accountPolicy && earlyGrade) accountPolicy = 'parent';
    if (kind === 'people' && parseBoolean(values.createAccount) && !accountPolicy) {
      errors.push('accountPolicy is required when gradeLevel does not imply the parent policy');
    }
    if (accountPolicy && !['parent', 'learner', 'both'].includes(accountPolicy)) {
      errors.push('accountPolicy must be parent, learner or both');
    }
    if (['parent', 'both'].includes(accountPolicy)
      && (!values.guardianGivenName || !values.guardianFamilyName || !values.guardianEmail)) {
      errors.push('guardianGivenName, guardianFamilyName and guardianEmail are required for parent or both policy');
    }
    return {
      rowNumber, kind, values: {
        ...values, personType: unifiedType || 'learner', givenName, familyName, email, learnerNumber,
        classId: targetClass?.id ?? null,
        academicYearId: targetClass?.academicYearId ?? null,
        createAccount: parseBoolean(values.createAccount),
        accountPolicy,
        gradeLevel
      },
      errors
    };
  });
}

function createTemporaryPassword() {
  return `Edu!${randomBytes(12).toString('base64url')}9a`;
}

function ensureRole(service, roleCode, actorId) {
  let role = [...service.roles.values()].find((item) => item.code === roleCode);
  if (role) return role;
  const permissionSets = {
    learner: ['academics.read', 'assignments.read', 'grading.read', 'attendance.read', 'lms.read', 'support.read'],
    teacher: ['academics.read', 'assignments.read', 'assignments.write', 'grading.read', 'grading.write', 'attendance.read', 'attendance.write', 'scheduling.read', 'lms.read', 'lms.write', 'support.read'],
    trainer: ['academics.read', 'assignments.read', 'grading.read', 'attendance.read', 'lms.read', 'lms.write', 'support.read']
  };
  const permissions = (permissionSets[roleCode] ?? [])
    .filter((code) => service.findPermissionByCode(code));
  role = new Role({ code: roleCode, name: roleCode, permissions });
  service.roles.set(role.id, role);
  service.recordCreate('roles', role, actorId, 'role.import-create');
  return role;
}

function ensureAccount(service, { person, organizationId, email, usernameCandidate, roleCode, importBatchId, actorId }) {
  let account = [...service.accounts.values()].find((item) =>
    item.personId === person.id || (email && item.email === email)
  );
  if (account && !account.organizationIds.includes(organizationId)) {
    throw new ValidationError('An account with this email belongs to another organization.');
  }
  let temporaryPassword = null;
  if (!account) {
    temporaryPassword = createTemporaryPassword();
    const baseUsername = String(usernameCandidate || email?.split('@')[0] || 'user')
      .toLowerCase().replace(/[^a-z0-9._-]/g, '-').slice(0, 40) || 'user';
    let username = baseUsername;
    let suffix = 1;
    while ([...service.accounts.values()].some((item) => item.username.toLowerCase() === username.toLowerCase())) {
      username = `${baseUsername}-${suffix++}`;
    }
    account = FoundationService.prototype.openUserAccount.call(service, {
      personId: person.id,
      username,
      email: email || `${username}@accounts.eduplateforme.invalid`,
      loginIdentifiers: [
        { type: 'username', value: username, verifiedAt: new Date().toISOString() },
        ...(email ? [{ type: 'email', value: email, verifiedAt: null }] : [])
      ],
      organizationIds: [organizationId],
      lifecycle: { metadata: { forcePasswordChange: true, importBatchId } }
    }, actorId);
    account.activate();
    service.recordCreate('accounts', account, actorId, 'account.import-create');
    service.setLocalPassword(account.id, temporaryPassword);
  }
  const role = ensureRole(service, roleCode, actorId);
  const assigned = [...service.roleAssignments.values()].some((item) =>
    item.personId === person.id && item.roleId === role.id && item.organizationId === organizationId
  );
  if (!assigned) {
    const assignment = FoundationService.prototype.assignRole.call(service, {
      personId: person.id,
      roleId: role.id,
      organizationId
    }, actorId);
    service.recordCreate('roleAssignments', assignment, actorId, 'role-assignment.import-create');
  }
  return temporaryPassword ? { username: account.username, email: email || null, temporaryPassword } : null;
}

function createOrReusePerson(service, values, organizationId, actorId) {
  const existing = findPersonByEmail(service, organizationId, values.email);
  if (existing) return { person: existing, created: false };
  const person = FoundationService.prototype.registerPerson.call(service, {
    givenName: values.givenName,
    familyName: values.familyName,
    primaryOrganizationId: organizationId,
    preferredLocale: values.locale || null,
    contacts: [
      ...(values.email ? [{ type: 'email', value: values.email, isPrimary: true }] : []),
      ...(values.phone ? [{ type: 'phone', value: values.phone, isPrimary: !values.email, verifiedAt: null }] : [])
    ]
  }, actorId);
  service.recordCreate('people', person, actorId, 'person.import-create');
  return { person, created: true };
}

function applyRows(service, { organizationId, kind, validatedRows, actorId, batchId }) {
  const credentials = [];
  const results = [];
  for (const row of validatedRows) {
    const { values } = row;
    if (kind === 'references') {
      let entry = [...service.referenceEntries.values()].find((item) =>
        item.organizationId === organizationId && item.catalog === values.catalog && item.code === values.code
      );
      const created = !entry;
      if (entry) {
        const before = entry;
        entry = new ReferenceEntry({
          ...structuredClone(entry),
          id: entry.id,
          labels: { ...entry.labels, ...values.labels },
          countryCode: values.countryCode,
          standard: false
        });
        entry.touch();
        service.referenceEntries.set(entry.id, entry);
        service.recordUpdate('referenceEntries', before, entry, actorId, 'reference.import-update');
      } else {
        entry = new ReferenceEntry({
          organizationId,
          catalog: values.catalog,
          code: values.code,
          labels: values.labels,
          countryCode: values.countryCode,
          standard: false
        });
        service.referenceEntries.set(entry.id, entry);
        service.recordCreate('referenceEntries', entry, actorId, 'reference.import-create');
      }
      results.push({ rowNumber: row.rowNumber, referenceEntryId: entry.id, created: { referenceEntry: created } });
      continue;
    }

    const isStaff = kind === 'staff' || ['teacher', 'trainer', 'staff'].includes(values.personType);
    const isGuardianOnly = kind === 'people' && ['guardian', 'parent'].includes(values.personType);
    const preexistingLearner = isStaff || isGuardianOnly ? null : [...service.learners.values()].find((item) =>
      item.organizationId === organizationId && item.learnerNumber === values.learnerNumber
    );
    const personResult = preexistingLearner
      ? { person: service.people.get(preexistingLearner.personId), created: false }
      : createOrReusePerson(service, values, organizationId, actorId);
    const { person, created: personCreated } = personResult;
    if (isGuardianOnly) {
      let profile = [...service.guardianProfiles.values()].find((item) =>
        item.organizationId === organizationId && item.personId === person.id
      );
      const profileCreated = !profile;
      if (!profile) {
        profile = new GuardianProfile({
          organizationId,
          personId: person.id,
          relationshipTypes: [values.relationship || 'guardian'],
          preferredContactChannels: values.email ? ['email'] : []
        });
        service.guardianProfiles.set(profile.id, profile);
        service.recordCreate('guardianProfiles', profile, actorId, 'guardian-profile.import-create');
      }
      if (values.createAccount) {
        const credential = ensureAccount(service, {
          person, organizationId, email: values.email, roleCode: 'parent',
          importBatchId: batchId, actorId
        });
        if (credential) credentials.push({ rowNumber: row.rowNumber, ...credential });
      }
      results.push({ rowNumber: row.rowNumber, personId: person.id, guardianProfileId: profile.id, created: { person: personCreated, profile: profileCreated } });
      continue;
    }
    if (isStaff) {
      let profile = [...service.professionalProfiles.values()].find((item) =>
        item.organizationId === organizationId && item.personId === person.id
      );
      let profileCreated = false;
      if (!profile) {
        profile = new ProfessionalProfile({
          organizationId,
          personId: person.id,
          professionalType: values.professionalType,
          assignmentOrganizationIds: [organizationId]
        });
        service.professionalProfiles.set(profile.id, profile);
        service.recordCreate('professionalProfiles', profile, actorId, 'professional-profile.import-create');
        profileCreated = true;
      }
      let assignment = [...service.professionalAssignments.values()].find((item) =>
        item.organizationId === organizationId
        && item.professionalProfileId === profile.id
        && item.roleTitle === values.roleTitle
        && (item.campusId ?? null) === (values.campusId ?? null)
      );
      let assignmentCreated = false;
      if (!assignment) {
        assignment = new ProfessionalAssignment({
          organizationId,
          professionalProfileId: profile.id,
          campusId: values.campusId,
          roleTitle: values.roleTitle,
          startsOn: values.startsOn
        });
        service.professionalAssignments.set(assignment.id, assignment);
        service.recordCreate('professionalAssignments', assignment, actorId, 'professional-assignment.import-create');
        assignmentCreated = true;
      }
      if (values.createAccount) {
        const credential = ensureAccount(service, {
          person, organizationId, email: values.email,
          roleCode: values.professionalType === 'trainer' ? 'trainer' : 'teacher',
          importBatchId: batchId, actorId
        });
        if (credential) credentials.push({ rowNumber: row.rowNumber, ...credential });
      }
      results.push({ rowNumber: row.rowNumber, personId: person.id, professionalProfileId: profile.id, assignmentId: assignment.id, created: { person: personCreated, profile: profileCreated, assignment: assignmentCreated } });
      continue;
    }

    let learner = preexistingLearner ?? [...service.learners.values()].find((item) =>
      item.organizationId === organizationId
      && (item.learnerNumber === values.learnerNumber || item.personId === person.id)
    );
    let learnerCreated = false;
    if (!learner) {
      learner = FoundationService.prototype.createLearner.call(service, {
        organizationId, personId: person.id, learnerNumber: values.learnerNumber
      }, actorId);
      service.recordCreate('learners', learner, actorId, 'learner.import-create');
      learnerCreated = true;
    }
    let enrollment = [...service.enrollments.values()].find((item) =>
      item.organizationId === organizationId && item.learnerId === learner.id && item.classId === values.classId
    );
    let enrollmentCreated = false;
    if (!enrollment) {
      enrollment = FoundationService.prototype.createEnrollment.call(service, {
        organizationId,
        personId: person.id,
        learnerId: learner.id,
        classId: values.classId,
        academicYearId: values.academicYearId,
        enrollmentReference: values.enrollmentReference || null,
        status: 'active'
      }, actorId);
      service.recordCreate('enrollments', enrollment, actorId, 'enrollment.import-create');
      enrollmentCreated = true;
    }
    if (values.createAccount) {
      if (['learner', 'both'].includes(values.accountPolicy || 'learner')) {
        const credential = ensureAccount(service, {
          person, organizationId, email: values.email, usernameCandidate: values.learnerNumber,
          roleCode: 'learner', importBatchId: batchId, actorId
        });
        if (credential) credentials.push({ rowNumber: row.rowNumber, accountFor: 'learner', ...credential });
      }
      if (['parent', 'both'].includes(values.accountPolicy)) {
        const guardianValues = {
          givenName: values.guardianGivenName,
          familyName: values.guardianFamilyName,
          email: normalizeEmail(values.guardianEmail),
          phone: values.guardianPhone
        };
        const guardianResult = createOrReusePerson(service, guardianValues, organizationId, actorId);
        let guardianProfile = [...service.guardianProfiles.values()].find((item) =>
          item.organizationId === organizationId && item.personId === guardianResult.person.id
        );
        if (!guardianProfile) {
          guardianProfile = new GuardianProfile({
            organizationId,
            personId: guardianResult.person.id,
            relationshipTypes: [values.relationship || 'parent'],
            preferredContactChannels: ['email']
          });
          service.guardianProfiles.set(guardianProfile.id, guardianProfile);
          service.recordCreate('guardianProfiles', guardianProfile, actorId, 'guardian-profile.import-create');
        }
        let relation = [...service.guardianLearnerRelations.values()].find((item) =>
          item.organizationId === organizationId
          && item.guardianProfileId === guardianProfile.id
          && item.learnerId === learner.id
          && item.status !== 'withdrawn'
        );
        if (!relation) {
          relation = new GuardianLearnerRelation({
            organizationId,
            guardianProfileId: guardianProfile.id,
            learnerId: learner.id,
            relationship: values.relationship || 'parent',
            permissions: ['academic.read', 'attendance.read', 'communications.read']
          });
          service.guardianLearnerRelations.set(relation.id, relation);
          service.recordCreate('guardianLearnerRelations', relation, actorId, 'guardian-relation.import-create');
        }
        const credential = ensureAccount(service, {
          person: guardianResult.person,
          organizationId,
          email: guardianValues.email,
          roleCode: 'parent',
          importBatchId: batchId,
          actorId
        });
        if (credential) credentials.push({ rowNumber: row.rowNumber, accountFor: 'guardian', ...credential });
      }
    }
    results.push({ rowNumber: row.rowNumber, personId: person.id, learnerId: learner.id, enrollmentId: enrollment.id, created: { person: personCreated, learner: learnerCreated, enrollment: enrollmentCreated } });
  }
  return { results, credentials };
}

export async function executeBulkImport(service, input, actorId) {
  const organizationId = input.organizationId;
  service.assertOrganizationContext(organizationId);
  const parsed = await parseImportFile(input);
  const validatedRows = validateRows(service, { ...input, organizationId, parsed });
  const errors = validatedRows.flatMap((row) => row.errors.map((message) => ({ rowNumber: row.rowNumber, message })));
  const preview = validatedRows.map((row) => ({ rowNumber: row.rowNumber, values: row.values, errors: row.errors }));
  const summary = { total: validatedRows.length, valid: validatedRows.length - new Set(errors.map((item) => item.rowNumber)).size, invalid: new Set(errors.map((item) => item.rowNumber)).size };
  if (input.dryRun !== false) {
    return { dryRun: true, kind: input.kind, schema: IMPORT_SCHEMAS[input.kind], limits: IMPORT_LIMITS, summary, rows: preview, errors };
  }
  if (errors.length > 0) throw new ValidationError('Import contains invalid rows. Run a dry-run and correct every row before applying.');
  if (!input.confirmed) throw new ValidationError('confirmed must be true before applying an online import.');
  const idempotencyKey = String(input.idempotencyKey ?? '').trim();
  if (!idempotencyKey) throw new ValidationError('idempotencyKey is required when applying an import.');
  const existing = [...service.importBatches.values()].find((batch) =>
    batch.organizationId === organizationId && batch.idempotencyKey === idempotencyKey
  );
  if (existing) {
    if (existing.fileDigest !== parsed.digest || existing.kind !== input.kind) {
      throw new ValidationError('idempotencyKey was already used for a different import.');
    }
    return { ...existing.result, replayed: true, credentials: [], credentialsAvailable: false };
  }

  const batchId = createPermanentId();
  const mutableCollections = ['people', 'learners', 'enrollments', 'guardianProfiles', 'guardianLearnerRelations', 'professionalProfiles', 'professionalAssignments', 'referenceEntries', 'accounts', 'roles', 'roleAssignments', 'importBatches'];
  const snapshots = Object.fromEntries(mutableCollections.map((key) => [key, new Map(service[key])]));
  try {
    return await service.transactional(() => {
      const applied = applyRows(service, { organizationId, kind: input.kind, validatedRows, actorId, batchId });
      const result = {
        dryRun: false,
        batchId,
        kind: input.kind,
        summary,
        rows: applied.results,
        errors: [],
        replayed: false,
        credentialsAvailable: applied.credentials.length > 0
      };
      const now = new Date().toISOString();
      const batch = {
        id: batchId,
        organizationId,
        idempotencyKey,
        fileDigest: parsed.digest,
        fileName: String(input.fileName),
        kind: input.kind,
        status: 'applied',
        result,
        createdAt: now,
        updatedAt: now
      };
      service.importBatches.set(batch.id, batch);
      service.recordCreate('importBatches', batch, actorId, 'bulk-import.apply');
      service.writeAuditEntry({
        actorId,
        organizationId,
        entityType: 'ImportBatch',
        entityId: batch.id,
        action: 'bulk-import.apply',
        after: { kind: input.kind, summary, fileDigest: parsed.digest }
      });
      return { ...result, credentials: applied.credentials };
    });
  } catch (error) {
    for (const [key, snapshot] of Object.entries(snapshots)) service[key] = snapshot;
    throw error;
  }
}

export function createImportTemplate(kind) {
  const headers = IMPORT_SCHEMAS[kind];
  if (!headers) throw new ValidationError(`Unsupported import kind: ${kind}.`);
  const examples = {
    people: ['learner', 'Awa', 'Diop', '', '', 'LRN-001', '3', '3A', 'Mame', 'Diop', 'mame.diop@example.edu', 'mother', '', '', '', '', 'true', 'parent'],
    learners: ['Awa', 'Diop', 'awa.diop@example.edu', 'LRN-001', '6A', 'true'],
    'class-roster': ['Awa', 'Diop', 'awa.diop@example.edu', 'LRN-001', 'true'],
    staff: ['Moussa', 'Ba', 'moussa.ba@example.edu', 'teacher', 'Professeur de mathématiques', '2026-09-01', '', 'true'],
    references: ['levels', 'PRIMARY-1', 'Première année primaire', 'Primary grade 1', '', '', '', 'SN']
  };
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return `${headers.map(escape).join(',')}\n${examples[kind].map(escape).join(',')}\n`;
}
