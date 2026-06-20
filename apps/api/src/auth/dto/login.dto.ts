import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class LoginDto {
  @IsString() @IsNotEmpty() address: string;
  @IsOptional() @IsString() signature?: string;
  @IsString() @IsNotEmpty() nonce: string;
}
