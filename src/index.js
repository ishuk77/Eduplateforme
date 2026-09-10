import { bootstrapApplication } from './app/bootstrap.js';

if (process.env.NODE_ENV !== 'test') {
  bootstrapApplication();
}
