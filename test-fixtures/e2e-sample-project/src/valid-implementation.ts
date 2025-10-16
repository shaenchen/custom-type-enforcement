// This file is VALID - follows all rules
import type { User, Product, UserRole } from './types.js';
import { OrderStatus } from './types.js';

export function getUser(id: string): User {
  return {
    id,
    name: 'Test User',
    email: 'test@example.com'
  };
}

export function processProduct(product: Product): void {
  console.log(`Processing product: ${product.title} - $${product.price}`);
}

export function checkRole(role: UserRole): boolean {
  return role === 'admin';
}

export function getOrderStatus(): OrderStatus {
  return OrderStatus.Pending;
}
