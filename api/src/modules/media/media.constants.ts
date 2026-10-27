export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const MEDIA_VARIANT_WIDTHS = [320, 800, 1600] as const;
export const THUMBNAIL_WIDTH = MEDIA_VARIANT_WIDTHS[0];
export const MEDIUM_WIDTH = MEDIA_VARIANT_WIDTHS[1];
export const LARGE_WIDTH = MEDIA_VARIANT_WIDTHS[2];

export const MEDIA_MIME_TYPE = 'image/webp';
