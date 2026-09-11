import { Entity, assertRequiredString } from '../../shared/entity.js';

export class ReportCard extends Entity {
  constructor({ id, organizationId, learnerId, period, average, rank = null, appreciation = null, absences = 0, decision = null }) {
    super({ id });
    this.organizationId = assertRequiredString(organizationId, 'organizationId');
    this.learnerId = assertRequiredString(learnerId, 'learnerId');
    this.period = assertRequiredString(period, 'period');
    this.average = Number(average);
    this.rank = rank;
    this.appreciation = appreciation;
    this.absences = Number(absences);
    this.decision = decision;
    this.pdfReference = `reports/${this.id}.pdf`;
  }
}
