const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://vopyrlgmwerzvpmjnyug.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvcHlybGdtd2VyenZwbWpueXVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MjIyNjEsImV4cCI6MjA5OTI5ODI2MX0.OsAf71jd80sTn9xfzH1K2a2GlC5rBz-R5KwuNm_fwDw');

(async () => {
  const { error } = await supabase.rpc('exec_sql', { query: 'ALTER TABLE documents ADD COLUMN IF NOT EXISTS source_module TEXT' });
  if (error) {
    console.log('RPC failed:', error.message);
    console.log('Trying via Supabase dashboard migration instead');
  } else {
    console.log('Column source_module added OK');
  }
})();
