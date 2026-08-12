-- Add ferias_gozo_id to ferias_escala_item to link scale items to their gozo
ALTER TABLE ferias_escala_item ADD COLUMN ferias_gozo_id UUID REFERENCES ferias(id) ON DELETE SET NULL;
CREATE INDEX idx_ferias_escala_item_gozo_id ON ferias_escala_item(ferias_gozo_id);
