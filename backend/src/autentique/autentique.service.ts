import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const PROD_API = 'https://api.autentique.com.br/v2/graphql';
const SANDBOX_API = 'https://api.sandbox.autentique.com.br/v2/graphql';

@Injectable()
export class AutentiqueService {
  private readonly token?: string;

  constructor(config: ConfigService) {
    this.token = config.get<string>('AUTENTIQUE_TOKEN');
  }

  async proxyJson(body: Record<string, unknown>, sandbox: boolean): Promise<unknown> {
    const response = await this.callAutentique({
      sandbox,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return response;
  }

  async proxyUpload(
    body: { operations?: string; map?: string },
    file: Express.Multer.File | undefined,
    sandbox: boolean,
  ): Promise<unknown> {
    if (!file) throw new BadRequestException('file is required');
    const formData = new FormData();
    formData.append('operations', body.operations ?? '');
    formData.append('map', body.map ?? '');
    formData.append('file', new Blob([new Uint8Array(file.buffer)]), file.originalname || 'file.pdf');

    return this.callAutentique({ sandbox, body: formData });
  }

  private async callAutentique(input: {
    sandbox: boolean;
    headers?: HeadersInit;
    body: BodyInit;
  }): Promise<unknown> {
    if (!this.token) {
      throw new InternalServerErrorException('AUTENTIQUE_TOKEN is not configured');
    }

    const response = await fetch(input.sandbox ? SANDBOX_API : PROD_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...input.headers,
      },
      body: input.body,
    });

    const text = await response.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = { error: text };
    }

    if (!response.ok) {
      throw new BadRequestException(json);
    }

    return json;
  }
}
