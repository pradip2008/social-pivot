import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional } from 'class-validator';

export class FanSignupDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;

  @IsNotEmpty()
  @IsString()
  companyId: string;
}

export class FanLoginDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  password: string;

  @IsNotEmpty()
  @IsString()
  companyId: string;
}

export class FanForgotPasswordDto {
  @IsEmail()
  email: string;

  @IsString()
  companyId: string;
}

export class FanResetPasswordDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}
