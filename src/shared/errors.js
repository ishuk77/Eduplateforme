import { ValidationError } from './entity.js';

export class ApiError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export { ValidationError };
