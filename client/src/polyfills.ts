const globalScope = globalThis as typeof globalThis & {
  process?: { env: Record<string, string | undefined> };
};

if (!globalScope.process) {
  globalScope.process = { env: { NODE_ENV: import.meta.env.MODE } };
} else if (!globalScope.process.env) {
  globalScope.process.env = { NODE_ENV: import.meta.env.MODE };
}
