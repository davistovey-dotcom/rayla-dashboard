import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response("Missing auth header", { status: 401 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response("Invalid user", { status: 401 });
    }

    const userId = user.id;

    // Delete user's trades first
    await supabase.from("trades").delete().eq("user_id", userId);

    // Delete the user
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteError) {
      return new Response(deleteError.message, { status: 500 });
    }

    return new Response("Account deleted", { status: 200 });
  } catch (err) {
    return new Response("Server error", { status: 500 });
  }
});