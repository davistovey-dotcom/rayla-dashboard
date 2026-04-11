// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const POLYGON_KEY = Deno.env.get("POLYGON_API_KEY");
    if (!POLYGON_KEY) throw new Error("Missing POLYGON_API_KEY");

    const { symbols } = await req.json();
    if (!Array.isArray(symbols) || symbols.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: "No symbols provided" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
      });
    }

    const results = {};
    for (const symbol of symbols.slice(0, 20)) {
      try {
        // Handle crypto symbols — strip exchange prefix
        const cleanSymbol = symbol.includes(":") ? symbol.split(":")[1] : symbol;
        // For crypto like BTCUSDT, convert to BTC
        const polygonSymbol = cleanSymbol.endsWith("USDT") ? "X:" + cleanSymbol.replace("USDT", "USD") : cleanSymbol;
        
        const res = await fetch(
          `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(polygonSymbol)}/prev?adjusted=true&apiKey=${POLYGON_KEY}`
        );
        const data = await res.json();
        
        if (data.results && data.results[0]) {
          const r = data.results[0];
          const change = r.o > 0 ? ((r.c - r.o) / r.o) * 100 : 0;
          results[symbol] = { price: r.c, change: parseFloat(change.toFixed(2)) };
        }
      } catch {}
    }

    return new Response(JSON.stringify({ ok: true, quotes: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }
});
