function getUser(): { id: string; name: string } {
  return { id: '1', name: 'Alice' };
}

const getConfig = (): { host: string; port: number } => {
  return { host: 'localhost', port: 3000 };
};
