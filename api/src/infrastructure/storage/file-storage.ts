export abstract class FileStorage {
  abstract put(key: string, data: Buffer): Promise<void>;
  abstract delete(key: string): Promise<void>;
  abstract urlFor(key: string): string;
}
