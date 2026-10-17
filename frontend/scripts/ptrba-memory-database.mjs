// Suporte SQL aos testes do backend real; nenhum acesso a banco ou dados reais.
export function createPtrbaMemoryDatabase(readRows, writeRows) {
  const sqlCalls = [];
  let sequence = readRows().length;
  const database = {
    sqlCalls,
    async query(sql, params = []) {
      sqlCalls.push(sql);
      const conditions = [...sql.matchAll(/"(id|equipe|data|created_by|origem_ptrba_id)" (>=|<=|=) \$(\d+)/g)];
      const selected = readRows().filter(row => conditions.every(([, column, op, index]) => {
        const value = params[Number(index) - 1];
        return op === '>=' ? row[column] >= value : op === '<=' ? row[column] <= value : row[column] === value;
      }));
      if (sql.startsWith('INSERT')) {
        const columns = sql.match(/\(([^)]+)\) VALUES/)[1].split(', ').map(v => v.replaceAll('"', ''));
        const values = Object.fromEntries(columns.map((c, i) => [c, params[i]]));
        const row = { id: `novo-${++sequence}`, is_apoc: false, created_at: '2026-10-15T10:00:00Z', ...values };
        readRows().push(row);
        return { rows: [structuredClone(row)] };
      }
      if (sql.startsWith('UPDATE')) {
        const columns = sql.match(/SET (.*?) WHERE/)[1].split(', ').map(v => v.match(/"([a-z_]+)"/)[1]);
        selected.forEach(row => columns.forEach((c, i) => { row[c] = params[i]; }));
      }
      if (sql.startsWith('DELETE')) {
        writeRows(readRows().filter(row => !selected.includes(row) && !selected.some(parent => row.origem_ptrba_id === parent.id)));
      }
      return { rows: structuredClone(selected) };
    },
    async transaction(run) {
      const snapshot = structuredClone(readRows());
      try { return await run(database); } catch (error) { writeRows(snapshot); throw error; }
    },
  };
  return database;
}
