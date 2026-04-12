import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class AddCommentDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  text: string;

  @IsOptional()
  @IsString()
  postId?: string;

  @IsOptional()
  @IsString()
  reelId?: string;
}
