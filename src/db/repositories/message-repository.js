import { BaseRepository } from './base-repository.js';

export class MessageRepository extends BaseRepository {
  constructor({ connection } = {}) {
    super({ connection, collectionKey: 'messages' });
  }
}
