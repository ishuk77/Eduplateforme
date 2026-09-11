import { makeCrudHandlers } from './_helpers.js';

export function registerFinanceRoutes(router, { service }) {
  const feeHandlers = makeCrudHandlers({
    service,
    resource: 'financeFees',
    create: (body, actorId) => service.configureFee(body, actorId),
    readPermission: 'finance.read',
    writePermission: 'finance.write'
  });
  const invoiceHandlers = makeCrudHandlers({
    service,
    resource: 'financeInvoices',
    create: (body, actorId) => service.createInvoice(body, actorId),
    readPermission: 'finance.read',
    writePermission: 'finance.write'
  });
  const paymentHandlers = makeCrudHandlers({
    service,
    resource: 'financePayments',
    create: (body, actorId) => service.recordPayment(body, actorId),
    readPermission: 'finance.read',
    writePermission: 'finance.write'
  });

  router.add('POST', '/finance/fees', feeHandlers.create);
  router.add('GET', '/finance/fees', feeHandlers.list);
  router.add('GET', '/finance/fees/:id', feeHandlers.get);
  router.add('PUT', '/finance/fees/:id', feeHandlers.update);
  router.add('DELETE', '/finance/fees/:id', feeHandlers.remove);
  router.add('GET', '/finance/fees/:id/history', feeHandlers.history);

  router.add('POST', '/finance/invoices', invoiceHandlers.create);
  router.add('GET', '/finance/invoices', invoiceHandlers.list);
  router.add('GET', '/finance/invoices/:id', invoiceHandlers.get);
  router.add('PUT', '/finance/invoices/:id', invoiceHandlers.update);
  router.add('DELETE', '/finance/invoices/:id', invoiceHandlers.remove);
  router.add('GET', '/finance/invoices/:id/history', invoiceHandlers.history);

  router.add('POST', '/finance/payments', paymentHandlers.create);
  router.add('GET', '/finance/payments', paymentHandlers.list);
  router.add('GET', '/finance/payments/:id', paymentHandlers.get);
  router.add('PUT', '/finance/payments/:id', paymentHandlers.update);
  router.add('DELETE', '/finance/payments/:id', paymentHandlers.remove);
  router.add('GET', '/finance/payments/:id/history', paymentHandlers.history);
}
