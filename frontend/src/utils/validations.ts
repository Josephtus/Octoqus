import { z } from 'zod';

export const loginSchema = z.object({
  mail: z.string().email('Geçerli bir e-posta adresi giriniz.'),
  password: z.string().min(1, 'Şifre boş olamaz.'),
});

export const registerSchema = z.object({
  name: z.string().min(2, 'Ad en az 2 karakter olmalıdır.').max(50, 'Ad çok uzun.'),
  surname: z.string().min(2, 'Soyad en az 2 karakter olmalıdır.').max(50, 'Soyad çok uzun.'),
  birthday: z.string().refine((val) => !isNaN(Date.parse(val)), 'Geçerli bir tarih giriniz.'),
  phone_number: z.string().regex(/^\+?[0-9]{10,15}$/, 'Geçerli bir telefon numarası giriniz (Örn: +905551234567).'),
  mail: z.string().email('Geçerli bir e-posta adresi giriniz.'),
  password: z.string().min(8, 'Şifre en az 8 karakter olmalıdır.')
    .regex(/[A-Z]/, 'Şifre en az bir büyük harf içermelidir.')
    .regex(/[a-z]/, 'Şifre en az bir küçük harf içermelidir.')
    .regex(/[0-9]/, 'Şifre en az bir rakam içermelidir.'),
});

export const expenseSchema = z.object({
  amount: z.number().positive('Tutar pozitif bir sayı olmalıdır.'),
  content: z.string().max(500, 'Açıklama çok uzun.').optional().nullable(),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), 'Geçerli bir tarih giriniz.'),
  category: z.string().optional().nullable(),
});

export const groupSchema = z.object({
  name: z.string().min(3, 'Grup adı en az 3 karakter olmalıdır.').max(100, 'Grup adı çok uzun.'),
  content: z.string().max(1000, 'Grup açıklaması çok uzun.').optional().nullable(),
});

export const resetPasswordSchema = z.object({
  new_password: z.string().min(8, 'Şifre en az 8 karakter olmalıdır.')
    .regex(/[A-Z]/, 'Şifre en az bir büyük harf içermelidir.')
    .regex(/[a-z]/, 'Şifre en az bir küçük harf içermelidir.')
    .regex(/[0-9]/, 'Şifre en az bir rakam içermelidir.'),
  confirm_password: z.string()
}).refine((data) => data.new_password === data.confirm_password, {
  message: "Şifreler eşleşmiyor.",
  path: ["confirm_password"],
});

export const profileSchema = z.object({
  name: z.string().min(2, 'Ad en az 2 karakter olmalıdır.').max(50, 'Ad çok uzun.'),
  surname: z.string().min(2, 'Soyad en az 2 karakter olmalıdır.').max(50, 'Soyad çok uzun.'),
  phone_number: z.string().regex(/^\+?[0-9]{10,15}$/, 'Geçerli bir telefon numarası giriniz.'),
  birthday: z.string().refine((val) => !isNaN(Date.parse(val)), 'Geçerli bir tarih giriniz.'),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type ExpenseFormData = z.infer<typeof expenseSchema>;
export type GroupFormData = z.infer<typeof groupSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
export type ProfileFormData = z.infer<typeof profileSchema>;
