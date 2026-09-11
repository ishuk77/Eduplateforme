import { BaseRepository } from './base-repository.js';

export class PersonRepository extends BaseRepository {
  constructor({ connection } = {}) {
    super({ connection, collectionKey: 'people' });
  }
}
