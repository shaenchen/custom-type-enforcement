type Readonly<T> = {
  [P in keyof T]: T[P];
};

type Optional<T> = {
  [K in keyof T]?: T[K];
};
