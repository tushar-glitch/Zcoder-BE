import { IsString, MaxLength, MinLength } from 'class-validator';

export class MediaAltTextDto {
  @IsString()
  @MinLength(5)
  @MaxLength(150)
  altText: string;
}
