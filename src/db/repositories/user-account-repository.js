import { BaseRepository } from './base-repository.js';

export class UserAccountRepository extends BaseRepository {
  constructor({ connection } = {}) {
    super({ connection, collectionKey: 'accounts' });
  }
}
