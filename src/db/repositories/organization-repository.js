import { BaseRepository } from './base-repository.js';

export class OrganizationRepository extends BaseRepository {
  constructor({ connection } = {}) {
    super({ connection, collectionKey: 'organizations' });
  }
}
