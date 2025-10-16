// This file imports types from a non-types file (VIOLATION)
import type { Customer } from './type-export-violation.js';
import { type PaymentMethod } from './type-export-violation.js';

export function handleCustomer(customer: Customer, payment: PaymentMethod): void {
  console.log(`Handling customer ${customer.id} with ${payment} payment`);
}
