export interface ImageVariant {
  width: number;
  data: Buffer;
}

export interface ProcessedImage {
  variants: ImageVariant[];
  width: number;
  height: number;
}

export abstract class ImageProcessor {
  abstract process(input: Buffer): Promise<ProcessedImage>;
}
