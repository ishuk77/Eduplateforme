import { BaseRepository } from './base-repository.js';

export class CalendarEventRepository extends BaseRepository {
  constructor({ connection } = {}) {
    super({ connection, collectionKey: 'calendarEvents' });
  }
}
