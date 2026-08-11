import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  const webhookSecret = process.env.VITE_AUTENTIQUE_WEBHOOK_SECRET;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const signature = req.headers['x-autentique-signature'];
  if (webhookSecret && signature) {
    const crypto = await import('crypto');
    const rawBody = JSON.stringify(req.body);
    const calculated = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    if (calculated !== signature) {
      return res.status(403).json({ error: 'Invalid signature' });
    }
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const event = req.body?.event;

  if (!event) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const eventType = event.type;
  const eventData = event.data;
  const autentiqueDocId = eventData?.object?.id || eventData?.document;

  if (!autentiqueDocId) {
    return res.status(200).json({ received: true });
  }

  try {
    const { data: fills } = await supabase
      .from('document_fills')
      .select('id, status')
      .eq('autentique_document_id', autentiqueDocId);

    if (!fills || fills.length === 0) {
      return res.status(200).json({ received: true, note: 'Documento nao encontrado no sistema' });
    }

    const fill = fills[0];

    if (eventType === 'document.finished') {
      await supabase
        .from('document_fills')
        .update({ status: 'signed', updated_at: new Date().toISOString() })
        .eq('id', fill.id);
    } else if (eventType === 'signature.accepted') {
      const object = eventData?.object || {};
      const signatureData = object.signed || eventData?.signed;
      const signedAt = signatureData?.created_at || new Date().toISOString();

      const currentData = fill.status === 'signed' ? fill : null;

      const { data: docData } = await supabase
        .from('document_fills')
        .select('filled_data')
        .eq('id', fill.id)
        .single();

      const filledData = docData?.filled_data || {};
      filledData.data_assinatura = signedAt;

      await supabase
        .from('document_fills')
        .update({ filled_data: filledData, updated_at: new Date().toISOString() })
        .eq('id', fill.id);
    } else if (eventType === 'signature.rejected') {
      await supabase
        .from('document_fills')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', fill.id);
    } else if (eventType === 'document.deleted') {
      await supabase
        .from('document_fills')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', fill.id);
    }
  } catch (err) {
    console.error('Erro ao processar webhook:', err);
  }

  return res.status(200).json({ received: true });
}
