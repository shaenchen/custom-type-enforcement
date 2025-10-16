function processUser(user: { id: string; name: string }) {
  return user.name;
}

const handler = (config: { host: string; port: number }) => {
  console.log(config.host);
};
