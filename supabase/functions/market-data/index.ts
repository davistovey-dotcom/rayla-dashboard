// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
 
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
 
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405,
    });
  }
 
  try {
    const POLYGON_KEY = Deno.env.get("POLYGON_API_KEY");
    if (!POLYGON_KEY) throw new Error("Missing POLYGON_API_KEY");
 
    const FINNHUB_KEY = Deno.env.get("FINNHUB_API_KEY");
    if (!FINNHUB_KEY) throw new Error("Missing FINNHUB_API_KEY");
 
    const { symbols } = await req.json();
 
    if (!Array.isArray(symbols) || symbols.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: "No symbols provided" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }
 
    const quotes: Record<string, { price: number; change: number }> = {};
 
    const CRYPTO_BASES = new Set(["BTC","ETH","SOL","XRP","DOGE","BNB","ADA","AVAX","LINK","MATIC","DOT","UNI","ATOM","LTC","BCH","ALGO","NEAR","FTM","SAND","MANA","TRX","TRON"]);
 
    const stockItems = symbols.filter(s => {
      const sym = String(s?.symbol || s || "").toUpperCase();
      const type = String(s?.type || "").toLowerCase();
      return type !== "crypto" && !CRYPTO_BASES.has(sym);
    }).slice(0, 20);
 
    const cryptoItems = symbols.filter(s => {
      const sym = String(s?.symbol || s || "").toUpperCase();
      const type = String(s?.type || "").toLowerCase();
      return type === "crypto" || CRYPTO_BASES.has(sym);
    }).slice(0, 20);
 
    
    
 
    // --- STOCKS: Massive batch snapshot ---
    if (stockItems.length > 0) {
      const tickerList = stockItems.map(s => String(s?.symbol || s).toUpperCase()).join(",");
      const url = `https://api.massive.com/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${encodeURIComponent(tickerList)}&apiKey=${POLYGON_KEY}`;
 
      try {
        const res = await fetch(url);
        const data = await res.json();
        
 
        for (const ticker of data?.tickers || []) {
          const sym = ticker.ticker;
          const price = ticker.day?.c || ticker.lastTrade?.p || ticker.prevDay?.c || 0;
          const prevClose = ticker.prevDay?.c || 0;
          const change = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;
 
          if (price > 0) {
            quotes[sym] = {
              price: Number(price.toFixed(2)),
              change: Number(change.toFixed(2)),
            };
          }
        }
      } catch (err) {
        console.error("stock snapshot failed:", err);
      }
    }
 
    // --- CRYPTO: Finnhub ---
    if (cryptoItems.length > 0) {
      for (const item of cryptoItems) {
        const sym = String(item?.symbol || item).toUpperCase();
        try {
          const url = `https://finnhub.io/api/v1/quote?symbol=BINANCE:${sym}USDT&token=${FINNHUB_KEY}`;
          const res = await fetch(url);
          const data = await res.json();
 
          const price = data.c ?? null;
          const prevClose = data.pc ?? null;
          const change = price && prevClose && prevClose !== 0
            ? ((price - prevClose) / prevClose) * 100
            : 0;
 
          if (price && price > 0) {
            quotes[sym] = {
              price: Number(price.toFixed(2)),
              change: Number(change.toFixed(2)),
            };
          }
        } catch (err) {
          console.error(`crypto fetch failed for ${sym}:`, err);
        }
      }
    }
 
    
    return new Response(JSON.stringify({ ok: true, quotes }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
 
  } catch (err) {
    console.error("market-data top-level error:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message || "Unknown error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});