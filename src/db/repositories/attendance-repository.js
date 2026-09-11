import { BaseRepository } from './base-repository.js';

export class AttendanceRepository extends BaseRepository {
  constructor({ connection } = {}) {
    super({ connection, collectionKey: 'attendance' });
  }
}
