import { Controller, Post, Body } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SuiService } from '../sui/sui.service';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { IsString, IsNumber } from 'class-validator';

class ExecuteDto {
  @IsString() recipient!: string;
  @IsNumber() amount_mist!: number;
}

@Controller('demo')
export class DemoController {
  private readonly betaKeypair: Ed25519Keypair;

  constructor(
    private readonly sui: SuiService,
    config: ConfigService,
  ) {
    const secretKey = config.get<string>('DEMO_BETA_SECRET_KEY')!;
    this.betaKeypair = Ed25519Keypair.fromSecretKey(secretKey);
  }

  @Post('execute')
  async execute(@Body() dto: ExecuteDto) {
    const tx = new Transaction();
    tx.setGasBudget(5_000_000);
    const [coin] = tx.splitCoins(tx.gas, [dto.amount_mist]);
    tx.transferObjects([coin], dto.recipient);

    const result = await this.sui.getClient().signAndExecuteTransaction({
      transaction: tx,
      signer: this.betaKeypair,
      options: { showEffects: true },
    });

    if (result.effects?.status.status !== 'success') {
      throw new Error(result.effects?.status.error ?? 'Transaction failed');
    }

    return {
      digest: result.digest,
      explorerUrl: `https://suiscan.xyz/testnet/tx/${result.digest}`,
    };
  }
}
