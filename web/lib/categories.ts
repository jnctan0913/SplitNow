// Maps category names (defined in the spreadsheet's Settings.categories) to
// Flaticon UICONS class names. If a category isn't in this map, fall back to
// the generic apps icon.

export const PAYMENT_CATEGORY = 'Payment';

export const CATEGORY_ICON: Record<string, string> = {
  Accommodation: 'fi-sr-home',
  Transport:     'fi-sr-train-side',
  Entertainment: 'fi-sr-music-note',
  Food:          'fi-sr-noodles',
  Shopping:      'fi-sr-shopping-bag',
  Other:         'fi-sr-apps',
  [PAYMENT_CATEGORY]: 'fi-sr-handshake',
};

export const CATEGORY_FALLBACK = 'fi-sr-apps';

export function categoryIcon(category: string): string {
  return CATEGORY_ICON[category] ?? CATEGORY_FALLBACK;
}

export function isPayment(e: { category?: string }): boolean {
  return e.category === PAYMENT_CATEGORY;
}
