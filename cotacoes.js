/* cotacoes.js — motor de cotacoes compartilhado (carteira.html + mae.html), v18 2026-06-17. Editar AQUI, nao nos HTMLs. */
const parseNumBR = s => { if(s==null) return NaN; return parseFloat(String(s).replace(/\./g,"").replace("%","").replace(",",".").trim()); };
/* ============ COTAÇÕES AUTOMÁTICAS ============ */
const PROXY  = u => "https://api.allorigins.win/raw?url="+encodeURIComponent(u);
const PROXY2 = u => "https://corsproxy.io/?url="+encodeURIComponent(u);
const PROXY3 = u => "https://api.codetabs.com/v1/proxy?quest="+encodeURIComponent(u);

// fetch com tempo-limite: serviço que não responde em X segundos é descartado na hora
function fetchT(u, ms=8000, opts){
  const c = new AbortController();
  const id = setTimeout(()=>c.abort(), ms);
  return fetch(u, Object.assign({signal:c.signal}, opts||{})).finally(()=>clearTimeout(id));
}

async function fetchFundamentus(url){
  // Tabela do Fundamentus por 5 caminhos diferentes: 4 proxies CORS + leitor de texto (jina)
  const tentativas = [
    ()=>fetchT("https://r.jina.ai/"+url,25000).then(r=>{ if(!r.ok) throw 0; return r.text(); }),
    ()=>fetchT(PROXY(url),10000).then(r=>{ if(!r.ok) throw 0; return r.text(); }),
    ()=>fetchT(PROXY2(url),10000).then(r=>{ if(!r.ok) throw 0; return r.text(); }),
    ()=>fetchT(PROXY3(url),10000).then(r=>{ if(!r.ok) throw 0; return r.text(); }),
    ()=>fetchT("https://api.allorigins.win/get?url="+encodeURIComponent(url),10000).then(r=>{ if(!r.ok) throw 0; return r.json(); }).then(j=>j.contents||""),
    ()=>fetchT("https://r.jina.ai/"+url,25000).then(r=>{ if(!r.ok) throw 0; return r.text(); }),
  ];
  for(const t of tentativas){
    try{
      const txt = await t();
      if(!txt || txt.length<1000) continue;
      const map = (txt.indexOf("<table")>=0 || txt.indexOf("<TABLE")>=0) ? parseFundHTML(txt) : parseFundTexto(txt);
      if(map && Object.keys(map).length>5) return map;
    }catch(e){}
  }
  throw new Error("todas as fontes falharam");
}
function parseFundHTML(html){
  const doc = new DOMParser().parseFromString(html,"text/html");
  const tbl = doc.querySelector("table#resultado") || doc.querySelector("table#tabelaResultado") || doc.querySelector("table");
  if(!tbl) return null;
  const heads = [...tbl.querySelectorAll("thead th, tr th")].map(th=>th.textContent.trim().toLowerCase());
  const iCot = heads.findIndex(h=>h.includes("cota"));
  const iPL  = heads.findIndex(h=>h==="p/l");
  const iPVP = heads.findIndex(h=>h.includes("p/vp"));
  const iDY  = heads.findIndex(h=>h.includes("yield")&&!h.includes("ffo"));
  const map = {};
  tbl.querySelectorAll("tbody tr").forEach(tr=>{
    const tds=[...tr.querySelectorAll("td")].map(td=>td.textContent.trim());
    if(!tds.length) return;
    map[tds[0].toUpperCase()] = {
      cot: iCot>=0?parseNumBR(tds[iCot]):NaN,
      pl:  iPL>=0?parseNumBR(tds[iPL]):NaN,
      pvp: iPVP>=0?parseNumBR(tds[iPVP]):NaN,
      dy:  iDY>=0?parseNumBR(tds[iDY]):NaN,
    };
  });
  return map;
}
function parseFundTexto(txt){
  // Versão em texto/markdown (leitor jina): linhas de tabela separadas por "|"
  const limpa = s => s.replace(/\[([^\]]*)\]\([^)]*\)/g,"$1").trim();
  let heads=null; const map={};
  for(const linha of txt.split(/\r?\n/)){
    let cs; var _TAB=String.fromCharCode(9);
    if(linha.indexOf("|")>=0) cs = linha.split("|").map(limpa);
    else if(linha.indexOf(_TAB)>=0) cs = linha.split(_TAB).map(limpa);
    else continue;
    while(cs.length && cs[0]==="") cs.shift();
    while(cs.length && cs[cs.length-1]==="") cs.pop();
    if(!cs.length || /^[-: ]+$/.test(cs.join(""))) continue;
    if(!heads){
      const low=cs.map(c=>c.toLowerCase());
      if(low.some(c=>c.includes("cota")) && low.some(c=>c.includes("p/vp"))) heads=low;
      continue;
    }
    const tk = cs[0].toUpperCase();
    if(!/^[A-Z]{4}\d{1,2}$/.test(tk)) continue;
    const iCot=heads.findIndex(h=>h.includes("cota"));
    const iPL=heads.findIndex(h=>h==="p/l");
    const iPVP=heads.findIndex(h=>h.includes("p/vp"));
    const iDY=heads.findIndex(h=>h.includes("yield")&&!h.includes("ffo"));
    map[tk]={
      cot: iCot>=0?parseNumBR(cs[iCot]):NaN,
      pl:  iPL>=0?parseNumBR(cs[iPL]):NaN,
      pvp: iPVP>=0?parseNumBR(cs[iPVP]):NaN,
      dy:  iDY>=0?parseNumBR(cs[iDY]):NaN,
    };
  }
  return map;
}

async function fetchStooq(tickers){
  // Cotações de ETFs americanos via Stooq (CSV), 1 requisição para todos — proxy + leitor jina
  const url = "https://stooq.com/q/l/?s="+tickers.map(t=>t.toLowerCase()+".us").join(",")+"&f=sd2t2ohlcv&h&e=csv";
  for(const u of [PROXY(url), PROXY3(url), "https://r.jina.ai/"+url]){
    try{
      const res = await fetchT(u, u.indexOf("r.jina.ai")>=0?25000:10000);
      if(!res.ok) continue;
      const csv = await res.text();
      const map = {};
      csv.split(/\r?\n/).forEach(l=>{
        const c = l.split(",");
        if(!c[0] || !/\.US$/i.test(c[0].trim())) return;
        const sym = c[0].trim().toUpperCase().replace(".US","");
        const close = parseFloat(c[6]);
        if(close>0) map[sym]=close;
      });
      if(Object.keys(map).length) return map;
    }catch(e){}
  }
  throw new Error("stooq indisponível");
}

async function fetchInfraPagina(ticker){
  // DY 12m + P/VP de FI-Infra lendo o card do Investidor10 via leitor jina (formato validado)
  const res = await fetchT("https://r.jina.ai/https://investidor10.com.br/fiis/"+ticker.toLowerCase()+"/", 25000);
  if(!res.ok) throw new Error("http "+res.status);
  const t = await res.text();
  const mDY = t.match(new RegExp(ticker+"[\\s\\S]{0,20}?DY \\(12M\\)[\\s\\S]{0,40}?(\\d{1,2}[.,]\\d{1,2})\\s*%","i"));
  if(!mDY) throw new Error("DY não encontrado");
  const resto = t.slice(mDY.index, mDY.index+400);
  const mPVP = resto.match(/P\/VP[\s\S]{0,40}?(\d{1,2}[.,]\d{1,2})/i);
  const dy = parseFloat(mDY[1].replace(",","."));
  if(!(dy>0 && dy<60)) throw new Error("DY fora da faixa");
  return { dy, pvp: mPVP ? parseFloat(mPVP[1].replace(",",".")) : null };
}

async function fetchBTC(){
  // Bitcoin em USD — 4 fontes em cadeia (Binance → Coinbase → CoinGecko → CoinGecko via proxy)
  const fontes=[
    async()=>{ const r=await fetchT("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT"); const j=await r.json(); return parseFloat(j.price); },
    async()=>{ const r=await fetchT("https://api.coinbase.com/v2/prices/BTC-USD/spot"); const j=await r.json(); return parseFloat(j.data && j.data.amount); },
    async()=>{ const r=await fetchT("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"); const j=await r.json(); return j.bitcoin && j.bitcoin.usd; },
    async()=>{ const r=await fetchT(PROXY("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd")); const j=await r.json(); return j.bitcoin && j.bitcoin.usd; },
  ];
  for(const f of fontes){ try{ const v=await f(); if(v>0) return v; }catch(e){} }
  throw new Error("BTC indisponível");
}

async function fetchYahoo(ticker){
  // Cotação de ativos americanos via Yahoo Finance — 5 caminhos, preço extraído por regex
  const alvo = h => "https://"+h+".finance.yahoo.com/v8/finance/chart/"+ticker;
  const urls = [
    PROXY(alvo("query1")),
    PROXY2(alvo("query1")),
    PROXY3(alvo("query1")),
    PROXY(alvo("query2")),
    "https://r.jina.ai/"+alvo("query1"),
  ];
  for(const u of urls){
    try{
      const res = await fetchT(u, u.indexOf("r.jina.ai")>=0?25000:8000);
      if(!res.ok) continue;
      const t = await res.text();
      const m = t.match(/"regularMarketPrice"\s*:\s*([\d.]+)/);
      const v = m ? parseFloat(m[1]) : NaN;
      if(v>0) return v;
    }catch(e){}
  }
  throw new Error("sem preço");
}

function achaChave(o,k){
  if(o && typeof o==="object"){
    if(o[k]!=null) return o[k];
    for(const x in o){ const r=achaChave(o[x],k); if(r!=null) return r; }
  }
  return null;
}
let proxiesB3 = [PROXY, PROXY3, PROXY2]; // o que funcionar vai para a frente da fila
async function fetchB3(ticker){
  // Endpoint público oficial da B3 — 3 proxies com auto-recuperação
  for(let i=0;i<proxiesB3.length;i++){
    const p = proxiesB3[i];
    try{
      const res = await fetchT(p("https://cotacao.b3.com.br/mds/api/v1/instrumentQuotation/"+ticker), 7000);
      if(!res.ok) continue;
      const j = await res.json();
      const v = parseFloat(achaChave(j,"curPrc"));
      if(v>0){ if(i>0) proxiesB3 = [p].concat(proxiesB3.filter(x=>x!==p)); return v; }
    }catch(e){}
  }
  throw new Error("sem curPrc");
}

async function fetchDY12m(ticker, token){
  // DY 12 meses: soma dos proventos pagos no último ano ÷ cotação (via brapi)
  const res = await fetchT(`https://brapi.dev/api/quote/${ticker}?dividends=true&token=${token}`);
  if(!res.ok) throw new Error("brapi "+res.status);
  const j = await res.json();
  const r = j.results && j.results[0];
  if(!r) throw new Error("sem dados");
  const price = parseFloat(r.regularMarketPrice);
  const divs = (r.dividendsData && r.dividendsData.cashDividends) || [];
  const lim = Date.now() - 365*24*60*60*1000;
  const soma = divs
    .filter(d=>{ const t=new Date(d.paymentDate||d.lastDatePrior||0).getTime(); return t>=lim && t<=Date.now()+30*864e5; })
    .reduce((s,d)=>s+(parseFloat(d.rate)||0),0);
  if(!(soma>0)||!(price>0)) throw new Error("sem proventos");
  return soma/price*100;
}

async function fetchBrapi(ticker, token){
  const res = await fetchT(`https://brapi.dev/api/quote/${ticker}?token=${token}`);
  if(!res.ok) throw new Error("brapi "+res.status);
  const j = await res.json();
  const r = j.results && j.results[0];
  return r && r.regularMarketPrice;
}

