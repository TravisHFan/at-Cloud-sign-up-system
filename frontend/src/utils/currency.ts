export function formatCurrency(
  amount: number,
  locale = "en-US",
  currency = "USD"
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    // Fallback if Intl fails or currency code not supported
    const fixed = Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
    return `$${fixed}`;
  }
}
