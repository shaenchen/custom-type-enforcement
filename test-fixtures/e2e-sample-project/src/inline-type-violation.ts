// This file uses inline types (VIOLATION)

export function createUser(userData: { name: string; email: string; age: number }): void {
  console.log(`Creating user: ${userData.name}`);
}

export const config: { apiUrl: string; timeout: number } = {
  apiUrl: 'https://api.example.com',
  timeout: 5000
};

export function processData(data: unknown): { success: boolean; message: string } {
  return { success: true, message: 'Processed' };
}
