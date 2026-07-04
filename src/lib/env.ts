// Env access that works in the browser (Vite import.meta.env) and in node
// under tsx (process.env), so the same lib code runs in the app and scripts/.

export function getEnv(name: string): string | undefined {
  // Vite statically replaces import.meta.env.* in browser builds; under
  // tsx/node import.meta.env is undefined, so guard and fall back.
  const viteEnv =
    typeof import.meta !== 'undefined'
      ? (import.meta as unknown as { env?: Record<string, string> }).env
      : undefined;
  const fromVite = viteEnv?.[name];
  if (fromVite) return fromVite;
  if (typeof process !== 'undefined' && process.env) {
    return process.env[name];
  }
  return undefined;
}
