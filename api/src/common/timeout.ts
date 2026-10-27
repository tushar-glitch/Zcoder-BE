export async function withTimeout<T>(work: Promise<T>, milliseconds: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const expiry = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), milliseconds);
  });

  try {
    return await Promise.race([work, expiry]);
  } finally {
    clearTimeout(timer);
  }
}
