import { BaseRepository } from './base-repository.js';

export class AssignmentRepository extends BaseRepository {
  constructor({ connection } = {}) {
    super({ connection, collectionKey: 'assignments' });
  }
}
