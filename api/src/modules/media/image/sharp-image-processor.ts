import { Injectable, UnsupportedMediaTypeException } from '@nestjs/common';
import sharp from 'sharp';
import { MEDIA_VARIANT_WIDTHS } from '../media.constants.js';
import { ImageProcessor, ImageVariant, ProcessedImage } from './image-processor.js';

const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp']);
const MAX_INPUT_PIXELS = 50_000_000;
const WEBP_QUALITY = 80;

@Injectable()
export class SharpImageProcessor extends ImageProcessor {
  async process(input: Buffer): Promise<ProcessedImage> {
    await this.assertAllowedFormat(input);

    const variants: ImageVariant[] = [];
    let largest = { width: 0, height: 0 };

    for (const width of MEDIA_VARIANT_WIDTHS) {
      const { data, info } = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer({ resolveWithObject: true });

      variants.push({ width, data });
      largest = { width: info.width, height: info.height };
    }

    return { variants, ...largest };
  }

  private async assertAllowedFormat(input: Buffer): Promise<void> {
    const format = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
      .metadata()
      .then((metadata) => metadata.format)
      .catch(() => undefined);

    if (!format || !ALLOWED_FORMATS.has(format)) {
      throw new UnsupportedMediaTypeException('Only JPEG, PNG and WebP images are accepted');
    }
  }
}
