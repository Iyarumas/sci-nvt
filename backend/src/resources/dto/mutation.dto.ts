import { Type } from 'class-transformer';
import { IsArray, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { FilterDto } from './resource-query.dto';

export class InsertDto {
  @IsOptional()
  payload?: Record<string, unknown> | Record<string, unknown>[];

  @IsOptional()
  @IsString()
  select?: string;
}

export class UpdateDto {
  @IsObject()
  payload!: Record<string, unknown>;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FilterDto)
  filters?: FilterDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  or?: string[];

  @IsOptional()
  @IsString()
  select?: string;
}

export class DeleteDto {
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FilterDto)
  filters?: FilterDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  or?: string[];

  @IsOptional()
  @IsString()
  select?: string;
}
