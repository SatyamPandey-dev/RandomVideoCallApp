import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://buitsxqjtesrphvsbwap.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1aXRzeHFqdGVzcnBodnNid2FwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzNDM2OTIsImV4cCI6MjA3MzkxOTY5Mn0.f7umFWJqDkzNhoV6LUAoT0bqYpEswuUB-_TJdA8kFio" // ⚠️ Public anon key, safe for frontend
);
