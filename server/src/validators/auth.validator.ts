import { z } from 'zod';

export const registerSchema = {
  body: z.object({
    email: z
      .string()
      .email('Please provide a valid email address')
      .transform((val) => val.trim().toLowerCase()),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters long')
      .max(100, 'Password cannot exceed 100 characters'),
  }),
};

export const loginSchema = {
  body: z.object({
    email: z
      .string()
      .email('Please provide a valid email address')
      .transform((val) => val.trim().toLowerCase()),
    password: z.string().min(1, 'Password is required'),
  }),
};

export const forgotPasswordSchema = {
  body: z.object({
    email: z
      .string()
      .email('Please provide a valid email address')
      .transform((val) => val.trim().toLowerCase()),
  }),
};

export const resetPasswordSchema = {
  body: z.object({
    token: z.string().min(1, 'Password reset token is required'),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters long')
      .max(100, 'New password cannot exceed 100 characters'),
  }),
};
