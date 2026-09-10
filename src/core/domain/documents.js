import { createDocumentId, createDocumentVersionId } from './identifiers.js';

export function createDocument({
  documentId = createDocumentId(),
  ownerType,
  ownerId,
  currentVersion,
  versions = []
}) {
  return {
    documentId,
    ownerType,
    ownerId,
    currentVersion,
    versions
  };
}

export function createDocumentVersion({
  versionId = createDocumentVersionId(),
  checksum,
  issuedAt,
  issuedBy,
  metadata = {}
}) {
  return {
    versionId,
    checksum,
    issuedAt,
    issuedBy,
    metadata
  };
}

export function appendDocumentVersion(document, version) {
  return {
    ...document,
    currentVersion: version.versionId,
    versions: [...document.versions, version]
  };
}
