import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Konfigürasyonu
 * Detaylar: https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Testleri paralel çalıştır */
  fullyParallel: true,
  /* CI üzerindeyseniz testleri durdurun */
  forbidOnly: !!process.env.CI,
  /* Hata durumunda tekrar dene */
  retries: process.env.CI ? 2 : 0,
  /* Paralel işçi sayısı */
  workers: process.env.CI ? 1 : undefined,
  /* Raporlama formatı */
  reporter: 'html',
  
  use: {
    /* Testlerin yapılacağı ana adres */
    baseURL: 'http://localhost:5174',

    /* Hata aldığında trace al (Hata ayıklama için çok önemli) */
    trace: 'on-first-retry',
    
    /* Screenshot ayarı */
    screenshot: 'only-on-failure',
    
    /* Video ayarı */
    video: 'on-first-retry',
  },

  /* Tarayıcı konfigürasyonları */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
