interface User {
  id: string;
  name: string;
}

function processUser(user: User): string {
  return user.name;
}
