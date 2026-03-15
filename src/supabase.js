import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://uoxzzhtnzmsolvcykynu.supabase.co";
const supabaseAnonKey = "sb_publishable_04NvzUT6Q6gGu7nZslKQwg_mu1D6G3A";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);