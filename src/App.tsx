import { useEffect, useState } from "react";
import { PEOPLES, JOLLOF_BATTLE, OTHER_BATTLES, getSOS, applyVote } from "./data/pantryData";

type Tab = "Home" | "Scan" | "Explore" | "Battles" | "Circle";

export default function App() {
  const [tab, setTab] = useState<Tab>("Home");
  const [pantry, setPantry] = useState<string[]>(() => JSON.parse(localStorage.getItem("pantry") || '["Rice","Tomato","Onion","Scotch Bonnet","Palm Oil"]'));
  const [contenders, setContenders] = useState(() => JSON.parse(localStorage.getItem("jollof") || JSON.stringify(JOLLOF_BATTLE.contenders)));
  const [region, setRegion] = useState("All");
  const [barcode, setBarcode] = useState("3017620422003");
  const [barcodeResult, setBarcodeResult] = useState<any>(null);
  const [missing, setMissing] = useState("palm oil");
  const [mode, setMode] = useState<"BROKE"|"AUTHENTIC"|"FASTEST">("AUTHENTIC");
  const [preview, setPreview] = useState<string>("");
  const [requests, setRequests] = useState([{user:"Keisha • 0.4mi", item:"Has eggs + plantain to share"}, {user:"Marcus • 0.8mi", item:"Needs scotch bonnet"}, {user:"Ama • 1.1mi", item:"Has palm oil to share"}]);

  useEffect(()=>{ localStorage.setItem("pantry", JSON.stringify(pantry)) },[pantry]);
  useEffect(()=>{ localStorage.setItem("jollof", JSON.stringify(contenders)) },[contenders]);

  const sorted = [...contenders].sort((a:any,b:any)=>b.elo-a.elo);
  const sos = getSOS(missing, mode, pantry);
  const filtered = region==="All" ? PEOPLES : PEOPLES.filter(p=>p.region===region);

  function vote(winnerIdx:number){
    const winner = sorted[winnerIdx];
    const loser = sorted[winnerIdx===0?1:0];
    const r = applyVote(winner.elo, loser.elo);
    setContenders(contenders.map((c:any)=> c.people===winner.people ? {...c, elo:r.winner} : c.people===loser.people ? {...c, elo:r.loser} : c));
    alert(`${winner.people} wins this round! +12 Elo`);
  }

  async function checkBarcode(){
    try{
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      const data = await res.json();
      if(data.status===1) setBarcodeResult({name:data.product.product_name, brand:data.product.brands, allergens:data.product.allergens||"None listed"});
      else setBarcodeResult({name:"Not found - try photo scan", brand:barcode, allergens:"Unknown"});
    }catch{ setBarcodeResult({name:"Mock: Nutella / Palm Oil Product", brand:"Demo Brand", allergens:"Check label"}); }
  }

  return (
    <div className="min-h-screen bg-[#1a120b] text-orange-50 pb-24 max-w-md mx-auto font-sans">
      <header className="p-4 bg-[#241a12] sticky top-0 z-10 flex justify-between items-center border-b border-orange-900">
        <div><h1 className="text-xl font-black text-orange-400">🌶️ PantryRoots</h1><p className="text-xs text-orange-200">One Pantry. Every Tribe.</p></div>
        <span className="text-xs bg-green-800 px-2 py-1 rounded-full">{pantry.length} items</span>
      </header>

      {tab==="Home" && <main className="p-4 space-y-4">
        <div className="bg-gradient-to-r from-orange-600 to-red-700 p-4 rounded-2xl"><h2 className="font-bold text-lg">Use It Up First</h2><p className="text-sm">{pantry.join(", ")}</p></div>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={()=>setTab("Scan")} className="bg-orange-500 p-4 rounded-2xl font-bold">📸 Scan Pantry</button>
          <button onClick={()=>setTab("Scan")} className="bg-green-700 p-4 rounded-2xl font-bold">📦 Scan Barcode</button>
          <button onClick={()=>setTab("Battles")} className="bg-red-700 p-4 rounded-2xl font-bold">⚔️ Jollof Wars</button>
          <button onClick={()=>setTab("Explore")} className="bg-yellow-700 p-4 rounded-2xl font-bold text-black">🌍 Explore Tribes</button>
        </div>

        <div className="bg-[#241a12] p-4 rounded-2xl border border-orange-900">
          <h3 className="font-bold mb-2">🚨 SOS - I'm Out Of...</h3>
          <div className="flex gap-2 mb-3">{(["BROKE","AUTHENTIC","FASTEST"] as const).map(m=><button key={m} onClick={()=>setMode(m)} className={`px-3 py-1 rounded-full text-xs font-bold ${mode===m?"bg-orange-500":"bg-gray-700"}`}>{m}</button>)}</div>
          <select value={missing} onChange={e=>setMissing(e.target.value)} className="w-full p-2 rounded bg-black mb-3">
            <option>palm oil</option><option>coconut milk</option><option>berbere</option><option>egusi</option><option>plantain</option><option>teff</option><option>broken rice</option>
          </select>
          <div className="bg-black/40 p-3 rounded-xl"><p className="font-bold text-orange-300">{sos.title}</p><p className="text-sm mt-1">{sos.body}</p><p className="text-xs mt-2">Worth-The-Trip Score: {sos.worthTrip}/10 {sos.probability?`| ${sos.probability}% Likely Has It`:""}</p>
          {sos.stores.length>0 && <div className="mt-3 space-y-2">{sos.stores.map((s:string)=><div key={s} className="flex justify-between bg-[#2d2015] p-2 rounded"><span className="text-sm">{s} • 0.8mi</span><span className="text-xs space-x-1"><a className="bg-green-700 px-2 py-1 rounded" target="_blank" href={`https://www.google.com/maps/search/${encodeURIComponent(s+" grocery near me")}`}>Directions</a><a className="bg-orange-600 px-2 py-1 rounded" target="_blank" href={`https://www.instacart.com/store/s?k=${encodeURIComponent(missing)}`}>Order</a></span></div>)}</div>}
          </div>
        </div>
      </main>}

      {tab==="Scan" && <main className="p-4 space-y-4">
        <h2 className="font-bold text-lg">Scan Pantry Photo</h2>
        <input type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0]; if(f) setPreview(URL.createObjectURL(f))}} className="w-full bg-[#241a12] p-3 rounded-xl"/>
        {preview && <img src={preview} className="rounded-2xl w-full h-48 object-cover"/>}
        <button onClick={()=>setPantry(["Rice","Tomato","Onion","Scotch Bonnet","Palm Oil","Plantain","Black Beans"])} className="w-full bg-orange-500 p-3 rounded-xl font-bold">🤖 Detect Ingredients (Demo)</button>
        <div className="space-y-2">{pantry.map((item,i)=><div key={i} className="flex justify-between bg-[#241a12] p-3 rounded-xl"><span>✅ {item}</span><button onClick={()=>setPantry(pantry.filter((_,x)=>x!==i))} className="text-red-400">✕</button></div>)}</div>
        <button onClick={()=>setTab("Battles")} className="w-full bg-green-700 p-3 rounded-xl font-bold">Cook With This → Battles</button>

        <h2 className="font-bold text-lg pt-4">Barcode / UPC Finder</h2>
        <div className="flex gap-2"><input value={barcode} onChange={e=>setBarcode(e.target.value)} className="flex-1 p-3 rounded bg-black" placeholder="Enter UPC"/><button onClick={checkBarcode} className="bg-orange-500 px-4 rounded font-bold">Find</button></div>
        {barcodeResult && <div className="bg-[#241a12] p-4 rounded-xl"><p className="font-bold">{barcodeResult.name}</p><p className="text-sm">Brand: {barcodeResult.brand}</p><p className="text-sm">Allergens: {barcodeResult.allergens}</p><p className="text-xs mt-2 text-green-300">Similar at: African Market 0.7mi (88%), Walmart 1.4mi (95%), H Mart 2.1mi</p></div>}
      </main>}

      {tab==="Explore" && <main className="p-4 space-y-4">
        <h2 className="font-bold text-lg">Explore By People / Tribe</h2>
        <div className="flex gap-2 flex-wrap">{["All","West Africa","East Africa"].map(r=><button key={r} onClick={()=>setRegion(r)} className={`px-3 py-1 rounded-full text-xs font-bold ${region===r?"bg-orange-500":"bg-gray-700"}`}>{r}</button>)}</div>
        {filtered.map(p=><div key={p.people} className="bg-[#241a12] p-4 rounded-2xl border border-orange-900"><h3 className="font-black text-orange-300">{p.people} <span className="text-xs text-white">• {p.modernArea} • {p.region}</span></h3>{p.dishes.map(d=><div key={d.name} className="mt-3 bg-black/30 p-3 rounded-xl"><p className="font-bold">{d.name}</p><p className="text-sm text-orange-100">{d.story}</p><p className="text-xs mt-1">Key: {d.keyIngredients.join(", ")}</p><p className="text-xs italic">Technique: {d.technique}</p></div>)}</div>)}
      </main>}

      {tab==="Battles" && <main className="p-4 space-y-4">
        <div className="bg-gradient-to-r from-red-800 to-orange-600 p-4 rounded-2xl text-center"><h2 className="text-2xl font-black">⚔️ JOLLOF WARS</h2><p className="text-sm">Same rice + tomato. Different ancestors. You decide.</p></div>
        <div className="bg-[#241a12] p-4 rounded-2xl"><h3 className="font-bold mb-2">🏆 Live Leaderboard (Elo)</h3>{sorted.map((c:any,i:number)=><div key={c.people} className="flex justify-between py-2 border-b border-orange-900/50"><span>#{i+1} {c.people} - {c.dish}</span><b className="text-orange-400">{c.elo}</b></div>)}</div>
        {sorted.map((c:any,i:number)=><div key={c.people} className="bg-[#241a12] p-4 rounded-2xl border border-orange-900"><h3 className="font-bold text-orange-300">{c.people}</h3><p className="font-black">{c.dish}</p><div className="text-sm mt-2 space-y-1"><p>🍚 Rice: {c.rice}</p><p>🍅 Base: {c.tomatoBase}</p><p>🔥 Smoke: {c.smoke}</p><p>🤫 Secret: {c.secret}</p><p>👩🏾‍🍳 Technique: {c.technique}</p></div><div className="flex gap-2 mt-3"><button onClick={()=>setTab("Home")} className="flex-1 bg-green-700 p-2 rounded font-bold text-sm">Cook This</button><button onClick={()=>vote(i)} className="flex-1 bg-orange-500 p-2 rounded font-bold text-sm">Vote +12</button></div></div>)}
        <h3 className="font-bold pt-2">Other Tribe Battles</h3>{OTHER_BATTLES.map(b=><div key={b.id} className="bg-[#241a12] p-4 rounded-2xl"><p className="font-bold">{b.title}</p><p className="text-sm">{b.items.join("  VS  ")}</p><p className="text-xs mt-1">Base: {b.base.join(", ")}</p></div>)}
      </main>}

      {tab==="Circle" && <main className="p-4 space-y-3">
        <h2 className="font-bold text-lg">👥 Pantry Circle - Village Borrowing</h2><p className="text-sm text-orange-200">Before you pay for delivery, ask your people nearby.</p>
        <button onClick={()=>setRequests([{user:"You • Now", item:`Need: ${missing} (${mode} mode)`},...requests])} className="w-full bg-orange-500 p-3 rounded-xl font-bold">+ Post Request: I need {missing}</button>
        {requests.map((r,i)=><div key={i} className="bg-[#241a12] p-4 rounded-2xl flex justify-between items-center"><div><p className="font-bold text-sm">{r.user}</p><p className="text-sm">{r.item}</p></div><button className="bg-green-700 px-3 py-2 rounded text-xs font-bold">Ask</button></div>)}
      </main>}

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-[#241a12] border-t border-orange-900 flex justify-around py-3">
        {([["Home","🏠"],["Scan","📸"],["Explore","🌍"],["Battles","⚔️"],["Circle","👥"]] as [Tab,string][]).map(([t,icon])=><button key={t} onClick={()=>setTab(t)} className={`flex flex-col items-center text-xs ${tab===t?"text-orange-400 font-bold":"text-gray-400"}`}><span className="text-xl">{icon}</span>{t}</button>)}
      </nav>
    </div>
  );
}