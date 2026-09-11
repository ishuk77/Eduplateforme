import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1, 'username is required'),
  password: z.string().min(8, 'password must contain at least 8 characters'),
  organizationId: z.string().min(1).optional().nullable()
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(32, 'refreshToken is required')
});

export const accountCreationSchema = z.object({
  personId: z.string().min(1, 'personId is required'),
  username: z.string().min(1, 'username is required'),
  email: z.string().email('email must be valid'),
  password: z.string().min(8, 'password must contain at least 8 characters').optional(),
  organizationIds: z.array(z.string().min(1)).default([])
});
