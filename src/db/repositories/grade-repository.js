import { BaseRepository } from './base-repository.js';

export class GradeRepository extends BaseRepository {
  constructor({ connection } = {}) {
    super({ connection, collectionKey: 'grades', sensitive: true });
  }
}
