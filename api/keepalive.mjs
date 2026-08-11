import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { count, error } = await supabase
    .from('usuarios')
    .select('*', { count: 'exact', head: true });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    usuarios: count,
  });
}
