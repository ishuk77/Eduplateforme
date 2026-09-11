import { BaseRepository } from './base-repository.js';

export class SubscriptionRepository extends BaseRepository {
  constructor({ connection } = {}) {
    super({ connection, collectionKey: 'platformSubscriptions' });
  }
}
