// Utility functions (VALID)

export function formatDate(date: Date): string {
  return date.toISOString();
}

export function calculateTotal(items: number[]): number {
  return items.reduce((sum, item) => sum + item, 0);
}
