import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

const OPERATORS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'is', 'like', 'ilike'] as const;

export class FilterDto {
  @IsString()
  column!: string;

  @IsIn(OPERATORS)
  operator!: (typeof OPERATORS)[number];

  @IsOptional()
  value?: unknown;

  @IsOptional()
  @IsArray()
  values?: unknown[];
}

export class OrderDto {
  @IsString()
  column!: string;

  @IsOptional()
  @IsBoolean()
  ascending?: boolean;
}

export class ResourceQueryDto {
  @IsOptional()
  @IsString()
  select?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FilterDto)
  filters?: FilterDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  or?: string[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => OrderDto)
  orders?: OrderDto[];

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsBoolean()
  head?: boolean;

  @IsOptional()
  @IsString()
  count?: 'exact';
}
