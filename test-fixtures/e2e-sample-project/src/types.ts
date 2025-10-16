// Valid types file - all type exports should be here
export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Product {
  id: string;
  title: string;
  price: number;
}

export type UserRole = 'admin' | 'user' | 'guest';

export enum OrderStatus {
  Pending = 'PENDING',
  Shipped = 'SHIPPED',
  Delivered = 'DELIVERED'
}
