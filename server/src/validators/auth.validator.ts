import { z } from 'zod';

const addressSchema = z.object({
  street: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  country: z.string().min(1, 'Country is required'),
  zipCode: z.string().min(1, 'ZIP / postal code is required'),
});

export const registerSchema = z.object({
  body: z
    .object({
      email: z.string().email(),
      password: z.string().min(8, 'Password must be at least 8 characters'),
      confirmPassword: z.string().min(8).optional(),
      firstName: z.string().min(1, 'First name is required'),
      lastName: z.string().min(1, 'Last name is required'),
      companyName: z.string().min(1, 'Company name is required'),
      phone: z.string().optional(),
      gst: z.string().optional(),
      pan: z.string().optional(),
      logo: z.string().optional(),
      logoFilename: z.string().optional(),
      address: addressSchema.optional(),
      agreeToTerms: z.literal(true, {
        errorMap: () => ({ message: 'You must accept the terms and conditions' }),
      }).optional(),
    })
    .refine((data) => !data.confirmPassword || data.password === data.confirmPassword, {
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
    remember: z.boolean().optional(),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email(),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    password: z.string().min(8),
  }),
});

const googleCompanyBodySchema = z.object({
  credential: z.string().min(1, 'Google credential is required'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  companyName: z.string().min(1, 'Company name is required'),
  phone: z.string().optional(),
  gst: z.string().optional(),
  pan: z.string().optional(),
  logo: z.string().optional(),
  logoFilename: z.string().optional(),
  address: addressSchema.optional(),
});

export const googleRegisterSchema = z.object({
  body: googleCompanyBodySchema,
});

export const googleLoginSchema = z.object({
  body: z.object({
    credential: z.string().min(1, 'Google credential is required'),
    remember: z.boolean().optional(),
  }),
});
