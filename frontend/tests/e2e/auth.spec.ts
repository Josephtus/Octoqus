import { test, expect } from '@playwright/test';

test.describe('Kimlik Doğrulama (Authentication)', () => {
  
  test.beforeEach(async ({ page }) => {
    // Her testten önce login sayfasına git
    await page.goto('/login');
  });

  test('Giriş sayfası doğru yüklenmeli', async ({ page }) => {
    await expect(page).toHaveTitle(/Octoqus/);
    await expect(page.getByText('Hoş Geldiniz')).toBeVisible();
  });

  test('Hatalı bilgilerle giriş denemesi hata vermeli', async ({ page }) => {
    // Formu doldur
    await page.fill('input[type="email"]', 'yanlis@test.com');
    await page.fill('input[type="password"]', 'yanlis-sifre');
    
    // Gönder
    await page.click('button[type="submit"]');

    // Hata mesajını bekle
    const errorAlert = page.locator('text=Giriş Hatası');
    await expect(errorAlert).toBeVisible();
  });

  test('Kayıt ol sayfasına yönlendirme çalışmalı', async ({ page }) => {
    await page.click('text=Ücretsiz Kayıt Ol');
    await expect(page).toHaveURL(/\/register/);
    await expect(page.getByRole('heading', { name: /Hesap Oluştur/i })).toBeVisible();
  });


});
