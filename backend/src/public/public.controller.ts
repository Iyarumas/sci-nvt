import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';

/**
 * Consultas abertas de proposito (sem login). Mantenha aqui somente dados que podem ser publicos.
 */
@Controller('public')
export class PublicController {
  constructor(private readonly database: DatabaseService) {}

  /** Lista somente leitura usada pela pagina /os/publica (link compartilhado de Ordens de Servico). */
  @Public()
  @Get('ordens-servico')
  async ordensServico() {
    const result = await this.database.query('SELECT * FROM ordens_servico ORDER BY created_at DESC');
    return { data: result.rows };
  }
}
