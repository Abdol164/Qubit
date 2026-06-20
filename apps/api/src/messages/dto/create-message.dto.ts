import { IsString, IsNotEmpty } from 'class-validator';

export class CreateMessageDto {
  @IsString() @IsNotEmpty() recipientAddress: string;
  @IsString() @IsNotEmpty() kemCiphertext: string;
  @IsString() @IsNotEmpty() ciphertext: string;
  @IsString() @IsNotEmpty() nonce: string;
}
