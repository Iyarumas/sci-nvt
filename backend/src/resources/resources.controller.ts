import { Body, Controller, Param, Post } from '@nestjs/common';
import { DeleteDto, InsertDto, UpdateDto } from './dto/mutation.dto';
import { ResourceQueryDto } from './dto/resource-query.dto';
import { ResourcesService } from './resources.service';

@Controller('data/:table')
export class ResourcesController {
  constructor(private readonly resources: ResourcesService) {}

  @Post('query')
  query(@Param('table') table: string, @Body() dto: ResourceQueryDto) {
    return this.resources.query(table, dto);
  }

  @Post('insert')
  insert(@Param('table') table: string, @Body() dto: InsertDto) {
    return this.resources.insert(table, dto);
  }

  @Post('update')
  update(@Param('table') table: string, @Body() dto: UpdateDto) {
    return this.resources.update(table, dto);
  }

  @Post('delete')
  delete(@Param('table') table: string, @Body() dto: DeleteDto) {
    return this.resources.delete(table, dto);
  }
}
