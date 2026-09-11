import { Entity, assertRequiredString } from '../../shared/entity.js';

export class Certificate extends Entity {
  constructor({ id, organizationId, learnerId, certificateType, title, verificationCode }) {
    super({ id });
    this.organizationId = assertRequiredString(organizationId, 'organizationId');
    this.learnerId = assertRequiredString(learnerId, 'learnerId');
    this.certificateType = assertRequiredString(certificateType, 'certificateType');
    this.title = assertRequiredString(title, 'title');
    this.verificationCode = assertRequiredString(verificationCode, 'verificationCode');
    this.qrCode = `qr://certificate/${this.verificationCode}`;
  }
}
