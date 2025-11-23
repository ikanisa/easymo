import { z } from 'zod';

export const userSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  role: z.enum(['user', 'admin', 'manager'], {
    errorMap: () => ({ message: 'Invalid role' }),
  }),
  status: z.enum(['active', 'inactive'], {
    errorMap: () => ({ message: 'Invalid status' }),
  }),
});

export type UserFormData = z.infer<typeof userSchema>;

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export type LoginFormData = z.infer<typeof loginSchema>;
