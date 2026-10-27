export function byIpAndEmail(request: Record<string, any>): string {
  const email = String(request.body?.email ?? '').trim().toLowerCase();
  return `${request.ip}:${email}`;
}
