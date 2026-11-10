import { supabaseConfig } from "./supabase-config.js";

export const FILE_BUCKET = "survey-uploads";
export const supabaseConfigured = Boolean(
  supabaseConfig.url.startsWith("https://") &&
  !supabaseConfig.publishableKey.startsWith("YOUR_")
);

const createClient = window.supabase?.createClient;
export const supabase = supabaseConfigured && createClient
  ? createClient(supabaseConfig.url, supabaseConfig.publishableKey)
  : null;
