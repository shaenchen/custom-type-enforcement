type IsString<T> = T extends string ? { value: string } : { value: number };
