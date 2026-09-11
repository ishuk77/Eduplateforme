import { BaseRepository } from './base-repository.js';

export class DisciplineRecordRepository extends BaseRepository {
  constructor({ connection } = {}) {
    super({ connection, collectionKey: 'disciplineRecords', sensitive: true });
  }
}
