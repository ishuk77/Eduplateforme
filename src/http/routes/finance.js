import { parseJson } from '../middleware/validation.js';
import { requireActor } from '../middleware/auth.js';

export function registerFinanceRoutes(router, { service }) {
  router.add('POST', '/finance/fees', async (request) => {
    const body = await parseJson(request);
    return Response.json(service.configureFee(body, requireActor(request)), { status: 201 });
  });

  router.add('POST', '/finance/invoices', async (request) => {
    const body = await parseJson(request);
    return Response.json(service.createInvoice(body, requireActor(request)), { status: 201 });
  });

  router.add('POST', '/finance/payments', async (request) => {
    const body = await parseJson(request);
    return Response.json(service.recordPayment(body, requireActor(request)), { status: 201 });
  });
}
