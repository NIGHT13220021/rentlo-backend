const { createClient } = require('@supabase/supabase-js');

let supabase = null;

const getSupabase = () => {
  if (supabase) return supabase;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error(`Missing env vars - URL: ${url ? 'OK' : 'MISSING'}, KEY: ${key ? 'OK' : 'MISSING'}`);
  }

  supabase = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabase;
};

module.exports = { supabase: getSupabase() };