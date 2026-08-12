-- Atualizar todos os font_size dos campos de documento para 12
UPDATE document_fields SET font_size = 12 WHERE font_size != 12;

-- Aumentar largura do campo funcao_solicitante para caber o nome completo
UPDATE document_fields SET width = 250 WHERE field_name = 'funcao_solicitante' AND width < 250;
