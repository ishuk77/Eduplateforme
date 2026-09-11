import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1, 'username is required'),
  password: z.string().min(8, 'password must contain at least 8 characters'),
  organizationId: z.string().min(1).optional().nullable()
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(32, 'refreshToken is required').optional()
});

export const registrationSchema = z.object({
  givenName: z.string().trim().min(1, 'givenName is required'),
  familyName: z.string().trim().min(1, 'familyName is required'),
  username: z.string().trim().min(3, 'username must contain at least 3 characters')
    .regex(/^[a-zA-Z0-9._-]+$/, 'username contains unsupported characters'),
  email: z.string().trim().email('email must be valid'),
  password: z.string().min(10, 'password must contain at least 10 characters')
});

export const onboardingSchema = z.object({
  legalName: z.string().trim().min(2, 'legalName is required'),
  displayName: z.string().trim().min(2, 'displayName is required'),
  internalReference: z.string().trim().min(2, 'internalReference is required'),
  countryCode: z.string().trim().length(2, 'countryCode must contain 2 characters'),
  organizationType: z.string().trim().min(1).default('institution')
});

export const accountCreationSchema = z.object({
  personId: z.string().min(1, 'personId is required'),
  username: z.string().min(1, 'username is required'),
  email: z.string().email('email must be valid'),
  password: z.string().min(8, 'password must contain at least 8 characters').optional(),
  organizationIds: z.array(z.string().min(1)).default([])
});
