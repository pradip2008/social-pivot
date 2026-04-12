import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AiService } from './ai.service';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

class GeneratePostDto {
  @IsString() @IsNotEmpty() topic: string;
  @IsString() @IsNotEmpty() platform: string;
  @IsString() @IsNotEmpty() tone: string;
  @IsString() @IsOptional() audience?: string;
  @IsString() @IsOptional() cta?: string;
  @IsString() @IsNotEmpty() length: string;
}

class GenerateImageDto {
  @IsString() @IsNotEmpty() prompt: string;
  @IsString() @IsOptional() style?: string;
  @IsString() @IsOptional() size?: string;
}

@UseGuards(AuthGuard('jwt'))
@Controller('ai')
export class AiController {
  constructor(private aiService: AiService) {}

  @Post('generate-post')
  async generatePost(@Request() req: any, @Body() body: GeneratePostDto) {
    return this.aiService.generatePost(req.user.sub, req.user.companyId, body);
  }

  @Post('generate-image')
  async generateImage(@Request() req: any, @Body() body: GenerateImageDto) {
    return this.aiService.generateImage(req.user.sub, req.user.companyId, body.prompt, body.style, body.size);
  }

  @Post('verify-openai')
  async verifyOpenAI(@Request() req: any, @Body() body: { apiKey?: string }) {
    return this.aiService.verifyOpenAIKey(req.user.companyId, body.apiKey);
  }
}
