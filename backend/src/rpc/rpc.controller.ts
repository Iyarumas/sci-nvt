import { Body, Controller, Param, Post } from '@nestjs/common';
import { RpcService } from './rpc.service';

@Controller('rpc')
export class RpcController {
  constructor(private readonly rpc: RpcService) {}

  @Post(':name')
  call(@Param('name') name: string, @Body() params: Record<string, unknown>) {
    return this.rpc.call(name, params ?? {});
  }
}
