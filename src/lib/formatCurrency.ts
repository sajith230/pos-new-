import { useAuth } from '@/hooks/useAuth';

const CURRENCY_LOCALE_MAP: Record<string, string> = {
  INR: 'en-IN',
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
  AED: 'ar-AE',
  SAR: 'ar-SA',
  JPY: 'ja-JP',
  CNY: 'zh-CN',
  CAD: 'en-CA',
  AUD: 'en-AU',
  SGD: 'en-SG',
  MYR: 'ms-MY',
  THB: 'th-TH',
  IDR: 'id-ID',
  PHP: 'en-PH',
  BDT: 'bn-BD',
  PKR: 'ur-PK',
  LKR: 'si-LK',
  NPR: 'ne-NP',
  KES: 'en-KE',
  NGN: 'en-NG',
  ZAR: 'en-ZA',
  BRL: 'pt-BR',
  MXN: 'es-MX',
};

/**
 * Format a number as currency.
 * @param amount  The numeric value to format
 * @param currency  ISO 4217 currency code (e.g. 'INR', 'USD')
 * @param maximumFractionDigits  Decimal places (default 2)
 */
export function formatCurrency(
  amount: number,
  currency: string = 'INR',
  maximumFractionDigits: number = 2,
): string {
  const locale = CURRENCY_LOCALE_MAP[currency] || undefined;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits,
  }).format(amount);
}

/**
 * React hook that returns a formatter bound to the current business currency.
 */
export function useCurrency() {
  const { business } = useAuth();
  const currency = business?.currency || 'INR';

  return {
    currency,
    format: (amount: number, fractionDigits?: number) =>
      formatCurrency(amount, currency, fractionDigits),
  };
}
