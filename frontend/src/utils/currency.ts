export function formatCurrency(
  amountInCents: number,
  locale = "en-US",
  currency = "USD"
): string {
  try {
    // Convert cents to dollars
    const amountInDollars = amountInCents / 100;
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).format(amountInDollars);
  } catch {
    // Fallback if Intl fails or currency code not supported
    const amountInDollars = amountInCents / 100;
    const fixed = Number.isFinite(amountInDollars)
      ? amountInDollars.toFixed(2)
      : "0.00";
    return `$${fixed}`;
  }
}
