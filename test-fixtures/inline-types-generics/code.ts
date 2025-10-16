function merge<T extends { id: string }>(a: T, b: T): T {
  return { ...a, ...b };
}
