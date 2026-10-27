export interface ErrorExtras {
  readonly extras: Record<string, unknown>;
}

export function hasErrorExtras(exception: unknown): exception is ErrorExtras {
  return typeof exception === 'object' && exception !== null && 'extras' in exception;
}
