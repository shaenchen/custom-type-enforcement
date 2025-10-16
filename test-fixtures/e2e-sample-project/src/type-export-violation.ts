// This file exports types from a non-types file (VIOLATION)

export interface Customer {
  id: string;
  name: string;
}

export type PaymentMethod = 'credit' | 'debit';

// This is actual implementation (mixed with types - still a violation)
export function processOrder(customerId: string): void {
  console.log(`Processing order for ${customerId}`);
}
