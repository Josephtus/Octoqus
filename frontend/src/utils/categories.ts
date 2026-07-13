
export interface Category {
  name: string;
  icon: string;
}

export const DEFAULT_CATEGORIES: Category[] = [
  { name: 'Konaklama', icon: '🛌' },
  { name: 'Eğlence', icon: '🎤' },
  { name: 'Market Alışverişi', icon: '🛒' },
  { name: 'Sağlık', icon: '🦷' },
  { name: 'Sigorta', icon: '🧯' },
  { name: 'Kira ve Masraflar', icon: '🏠' },
  { name: 'Restoranlar ve Barlar', icon: '🍔' },
  { name: 'Shopping', icon: '🛍️' },
  { name: 'Transport', icon: '🚕' },
  { name: 'Fatura', icon: '🧾' },
  { name: 'Balık', icon: '🐟' },
  { name: 'Yufkacı', icon: '🥟' },
  { name: 'Kasap', icon: '🥩' },
  { name: 'İçme suyu', icon: '💧' },
  { name: 'Halı Yıkama', icon: '🧼' },
  { name: 'Diğer', icon: '🖐️' },
];

export const getCategoryIcon = (categoryName: string | undefined, customCategories: Category[] = []) => {
  if (!categoryName) return '₺';
  
  const allCategories = [...DEFAULT_CATEGORIES, ...customCategories];
  const found = allCategories.find(c => c.name === categoryName);
  return found ? found.icon : '📦';
};
