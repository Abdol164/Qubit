import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';

@Injectable()
export class SuiService implements OnModuleInit {
  private client!: SuiJsonRpcClient;
  private registryObjectId!: string;
  private readonly logger = new Logger(SuiService.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const network = this.config.get<string>('SUI_NETWORK', 'testnet') as
      | 'mainnet' | 'testnet' | 'devnet' | 'localnet';
    this.client = new SuiJsonRpcClient({ url: getJsonRpcFullnodeUrl(network), network });
    this.registryObjectId = this.config.get<string>('SUI_REGISTRY_OBJECT_ID')!;
  }

  getClient(): SuiJsonRpcClient {
    return this.client;
  }

  // Check if a Sui address has registered their ML-KEM public key on-chain.
  // Uses getDynamicFieldObject on the Registry shared object's public_keys table.
  async isRegistered(address: string): Promise<boolean> {
    try {
      const result = await this.client.getDynamicFieldObject({
        parentId: this.registryObjectId,
        name: { type: 'address', value: address },
      });
      return result.data !== null;
    } catch (err) {
      this.logger.warn(`isRegistered check failed for ${address}: ${err}`);
      return false;
    }
  }
}
