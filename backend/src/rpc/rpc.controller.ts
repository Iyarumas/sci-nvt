import { Body, Controller, Param, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { RpcService } from './rpc.service';

@Controller('rpc')
export class RpcController {
  constructor(private readonly rpc: RpcService) {}

  @Post(':name')
  call(@Param('name') name: string, @Body() params: Record<string, unknown>, @Req() request: Request) {
    return this.rpc.call(name, params ?? {}, request.authUser!);
  }
}
