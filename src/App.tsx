import { useEffect, useState } from "react";
import { Home, Camera, Globe2, Swords, Users, Search, Clock, Flame, ChevronRight, MapPin, Phone, ShoppingCart, Plus, X, ScanBarcode, Sparkles, Trophy, Leaf } from "lucide-react";
import { PEOPLES, JOLLOF_BATTLE, OTHER_BATTLES, getSOS, applyVote } from "./data/pantryData";

type Tab = "Home" | "Scan" | "Explore" | "Battles" | "Circle";
const cx = (...c:any[])=>c.filter(Boolean).join(" ");

function Chip({active,children,onClick}:any){ return <button onClick={onClick} className={cx("px-3.5 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap transition", active?"bg-ink text-white":"bg-white text-stone2 border border-sand hover:border-stone-300")}>{children}</button> }
function Card({children,className=""}:any){ return <div className={`bg-white rounded-[20px] border border-sand shadow-card ${className}`}>{children}</div> }
function SectionTitle({title,sub}:any){ return <div className="mb-3"><h2 className="font-display text-[20px] leading-tight font-semibold">{title}</h2>{sub&&<p className="text-[13px] text-stone2 mt-0.5">{sub}</p>}</div> }

export default function App(){
  const [tab,setTab]=useState<Tab>("Home");
  const [pantry,setPantry]=useState<string[]>(()=>JSON.parse(localStorage.getItem("pantry")||'["Rice","Tomato","Onion","Scotch Bonnet","Palm Oil"]'));
  const [contenders,setContenders]=useState<any[]>(()=>JSON.parse(localStorage.getItem("jollof")||JSON.stringify(JOLLOF_BATTLE.contenders)));
  const [region,setRegion]=useState("All");
  const [barcode,setBarcode]=useState("3017620422003");
  const [barcodeResult,setBarcodeResult]=useState<any>(null);
  const [missing,setMissing]=useState("palm oil");
  const [mode,setMode]=useState<"BROKE"|"AUTHENTIC"|"FASTEST">("AUTHENTIC");
  const [preview,setPreview]=useState("");
  const [query,setQuery]=useState("");
  const [requests,setRequests]=useState([{user:"Keisha M.",dist:"0.4 mi",item:"Eggs & plantain available",time:"12m"},{user:"Marcus T.",dist:"0.8 mi",item:"Looking for scotch bonnet",time:"34m"},{user:"Ama K.",dist:"1.1 mi",item:"Palm oil available to share",time:"1h"}]);

  useEffect(()=>{localStorage.setItem("pantry",JSON.stringify(pantry))},[pantry]);
  useEffect(()=>{localStorage.setItem("jollof",JSON.stringify(contenders))},[contenders]);

  const sorted=[...contenders].sort((a,b)=>b.elo-a.elo);
  const sos=getSOS(missing,mode,pantry);
  const filtered=PEOPLES.filter(p=>(region==="All"||p.region===region)&&(query===""||p.people.toLowerCase().includes(query.toLowerCase())||p.dishes.some(d=>d.name.toLowerCase().includes(query.toLowerCase()))));

  function vote(i:number){ const w=sorted[i]; const l=sorted[i===0?1:0]; const r=applyVote(w.elo,l.elo); setContenders(contenders.map(c=>c.people===w.people?{...c,elo:r.winner}:c.people===l.people?{...c,elo:r.loser}:c)); }
  async function checkBarcode(){ try{ const res=await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`); const d=await res.json(); setBarcodeResult(d.status===1?{name:d.product.product_name,brand:d.product.brands||"—",allergens:d.product.allergens||"None listed"}:{name:"Product not found",brand:barcode,allergens:"Try a different UPC"});}catch{ setBarcodeResult({name:"Hazelnut Spread",brand:"Demo Product",allergens:"Hazelnut, Milk"});} }

  return(
  <div className="min-h-screen bg-paper pb-[92px] max-w-[430px] mx-auto relative">
    {/* Header - Airbnb/Instacart style */}
    <header className="sticky top-0 z-20 bg-paper/90 backdrop-blur border-b border-sand">
      <div className="px-5 h-[64px] flex items-center justify-between">
        <div><p className="font-display font-bold text-[19px] leading-none">PantryRoots</p><p className="text-[11px] tracking-wide text-stone2 uppercase mt-1">One pantry · Every tribe</p></div>
        <div className="flex items-center gap-2 bg-white border border-sand rounded-full pl-3 pr-1 py-1 shadow-card"><Leaf size={14} className="text-sage"/><span className="text-[13px] font-semibold">{pantry.length} items</span><span className="bg-clay text-white text-[11px] font-bold px-2 py-1 rounded-full">PRO</span></div>
      </div>
    </header>

    {tab==="Home"&&<main className="px-5 pt-5 space-y-7">
      <div><h1 className="font-display text-[28px] leading-[1.05] font-semibold">What can your<br/>pantry become?</h1><p className="text-stone2 text-[14px] mt-2">Cook from your roots, not just your recipes.</p></div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">{pantry.map(i=><span key={i} className="bg-white border border-sand rounded-full px-3 py-1.5 text-[13px] whitespace-nowrap shadow-card">{i}</span>)}</div>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={()=>setTab("Scan")} className="bg-ink text-white rounded-[20px] p-4 text-left shadow-pop"><Camera size={20}/><p className="font-semibold mt-3 text-[15px]">Scan pantry</p><p className="text-white/60 text-[12px]">Photo to ingredients</p></button>
        <button onClick={()=>setTab("Scan")} className="bg-white rounded-[20px] p-4 text-left border border-sand shadow-card"><ScanBarcode size={20} className="text-clay"/><p className="font-semibold mt-3 text-[15px]">Scan barcode</p><p className="text-stone2 text-[12px]">Find it near you</p></button>
      </div>

      <div><SectionTitle title="Battle of the week" sub="Same base. Different ancestors."/>
        <Card className="overflow-hidden"><div className="h-[140px] bg-[url('https://images.unsplash.com/photo-1574484284002-952d92456975?w=800&q=80')] bg-cover bg-center"/><div className="p-4"><div className="flex justify-between items-center"><p className="font-semibold">Jollof Wars</p><span className="text-[11px] font-bold bg-red-50 text-clay px-2 py-1 rounded-full flex items-center gap-1"><Flame size={12}/> LIVE</span></div><p className="text-[13px] text-stone2 mt-1">Nigeria vs Ghana vs Senegal — {sorted[0].people} is leading with {sorted[0].elo} pts.</p><button onClick={()=>setTab("Battles")} className="mt-3 w-full bg-clay hover:bg-clayDark text-white rounded-full py-2.5 text-[14px] font-semibold">Enter battle</button></div></Card>
      </div>

      <div><SectionTitle title="I'm out of something" sub="Get a substitute or find it nearby."/>
        <Card className="p-4">
          <div className="bg-paper rounded-full p-1 grid grid-cols-3 gap-1">{(["BROKE","AUTHENTIC","FASTEST"] as const).map(m=><button key={m} onClick={()=>setMode(m)} className={cx("py-2 rounded-full text-[12px] font-semibold capitalize",mode===m?"bg-white shadow-card text-ink":"text-stone2")}>{m.toLowerCase()}</button>)}</div>
          <label className="text-[12px] font-semibold uppercase tracking-wide text-stone2 block mt-4 mb-1.5">Missing ingredient</label>
          <select value={missing} onChange={e=>setMissing(e.target.value)} className="w-full bg-paper border border-sand rounded-xl px-3 py-2.5 text-[14px] outline-none focus:border-clay"><option>palm oil</option><option>coconut milk</option><option>berbere</option><option>egusi</option><option>plantain</option><option>teff</option><option>broken rice</option></select>
          <div className="mt-4 bg-[#FFF7ED] border border-orange-100 rounded-xl p-3.5"><p className="font-semibold text-[14px]">{sos.title}</p><p className="text-[13px] text-stone-600 mt-1 leading-relaxed">{sos.body}</p><div className="flex gap-4 mt-2.5 text-[12px] font-medium"><span>Worth the trip: {sos.worthTrip}/10</span>{sos.probability>0&&<span className="text-sage">{sos.probability}% likely in stock</span>}</div></div>
          {sos.stores.map((s:string)=> <div key={s} className="flex items-center justify-between py-3 border-b border-sand last:border-0"><div className="flex gap-3 items-center"><div className="w-9 h-9 rounded-full bg-paper flex items-center justify-center border border-sand"><MapPin size={16} className="text-clay"/></div><div><p className="text-[14px] font-medium leading-none">{s}</p><p className="text-[12px] text-stone2 mt-1">0.8 mi · Open until 10 PM</p></div></div><div className="flex gap-1.5"><a target="_blank" href={`https://www.google.com/maps/search/${encodeURIComponent(s+" grocery near me")}`} className="px-3 py-1.5 rounded-full border border-sand text-[12px] font-semibold bg-white">Directions</a><a target="_blank" href={`https://www.instacart.com/store/s?k=${encodeURIComponent(missing)}`} className="px-3 py-1.5 rounded-full bg-ink text-white text-[12px] font-semibold flex items-center gap-1"><ShoppingCart size={12}/>Order</a></div></div>)}
        </Card>
      </div>
    </main>}

    {tab==="Scan"&&<main className="px-5 pt-5 space-y-6">
      <div><h1 className="font-display text-[26px] font-semibold">Scan</h1><p className="text-stone2 text-[14px]">Add items to your pantry in seconds.</p></div>
      <Card className="p-4"><p className="font-semibold text-[15px] mb-3">Pantry photo</p><label className="block border-2 border-dashed border-sand rounded-[16px] overflow-hidden cursor-pointer bg-paper">{preview?<img src={preview} className="w-full h-[200px] object-cover"/>:<div className="h-[160px] flex flex-col items-center justify-center text-stone2"><Camera size={24}/><p className="text-[13px] mt-2 font-medium">Tap to upload pantry photo</p></div>}<input type="file" accept="image/*" className="hidden" onChange={e=>{const f=e.target.files?.[0]; if(f) setPreview(URL.createObjectURL(f))}}/></label><button onClick={()=>setPantry(["Rice","Tomato","Onion","Scotch Bonnet","Palm Oil","Plantain","Black Beans"])} className="mt-3 w-full bg-ink text-white py-3 rounded-full font-semibold text-[14px] flex items-center justify-center gap-2"><Sparkles size={16}/> Detect ingredients</button></Card>
      <div><SectionTitle title={`In your pantry (${pantry.length})`}/><div className="space-y-2">{pantry.map((item,i)=><div key={i} className="bg-white border border-sand rounded-[14px] px-4 py-3 flex justify-between items-center shadow-card"><span className="text-[14px] font-medium">{item}</span><button onClick={()=>setPantry(pantry.filter((_,x)=>x!==i))} className="text-stone-400 hover:text-clay"><X size={16}/></button></div>)}</div><button onClick={()=>setTab("Battles")} className="mt-4 w-full bg-clay text-white py-3 rounded-full font-semibold text-[14px]">Find recipes & battles</button></div>
      <Card className="p-4"><p className="font-semibold text-[15px]">Barcode lookup</p><p className="text-[13px] text-stone2 mt-0.5">Powered by Open Food Facts</p><div className="flex gap-2 mt-3"><input value={barcode} onChange={e=>setBarcode(e.target.value)} className="flex-1 bg-paper border border-sand rounded-xl px-3 py-2.5 text-[14px] outline-none focus:border-clay" placeholder="Enter UPC"/><button onClick={checkBarcode} className="bg-ink text-white px-4 rounded-xl font-semibold text-[14px]">Find</button></div>{barcodeResult&&<div className="mt-3 bg-paper rounded-xl p-3 border border-sand"><p className="font-semibold text-[14px]">{barcodeResult.name}</p><p className="text-[13px] text-stone2">Brand: {barcodeResult.brand} · Allergens: {barcodeResult.allergens}</p><p className="text-[12px] text-sage font-medium mt-2">Also likely at African Market (88%) · Walmart (95%)</p></div>}</Card>
    </main>}

    {tab==="Explore"&&<main className="px-5 pt-5 space-y-5">
      <div><h1 className="font-display text-[26px] font-semibold">Explore by people</h1><p className="text-stone2 text-[14px]">Indigenous foodways, not just countries.</p></div>
      <div className="relative"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search tribe, dish, ingredient" className="w-full bg-white border border-sand rounded-full pl-10 pr-4 py-3 text-[14px] shadow-card outline-none focus:border-clay"/></div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">{["All","West Africa","East Africa"].map(r=><Chip key={r} active={region===r} onClick={()=>setRegion(r)}>{r}</Chip>)}</div>
      <div className="space-y-4">{filtered.map(p=><Card key={p.people} className="p-4"><div className="flex justify-between items-start"><div><p className="font-display font-semibold text-[18px]">{p.people}</p><p className="text-[12px] text-stone2">{p.modernArea} · {p.region}</p></div><span className="text-[11px] font-bold bg-paper border border-sand px-2 py-1 rounded-full">{p.dishes.length} dishes</span></div><div className="mt-3 space-y-2">{p.dishes.map(d=><div key={d.name} className="rounded-[14px] bg-paper border border-sand p-3"><div className="flex justify-between"><p className="font-semibold text-[14px]">{d.name}</p><ChevronRight size={16} className="text-stone-400"/></div><p className="text-[13px] text-stone-600 mt-1 leading-relaxed">{d.story}</p><p className="text-[11px] text-stone2 mt-2"><span className="font-semibold text-ink">Key:</span> {d.keyIngredients.join(", ")} · {d.technique}</p></div>)}</div></Card>)}</div>
    </main>}

    {tab==="Battles"&&<main className="px-5 pt-5 space-y-6">
      <div className="bg-ink text-white rounded-[24px] p-5 shadow-pop"><div className="flex items-center gap-2 text-orange-300 text-[11px] font-bold tracking-widest uppercase"><Trophy size={14}/> Featured battle</div><h1 className="font-display text-[30px] font-semibold mt-2">Jollof Wars</h1><p className="text-white/60 text-[13px] mt-1">One base — rice, tomato, onion, pepper. Five ancestors. Vote for the technique, not just the taste.</p></div>
      <Card className="p-2"><p className="px-3 pt-3 pb-1 text-[12px] font-bold uppercase tracking-wide text-stone2">Live leaderboard</p>{sorted.map((c:any,i:number)=><div key={c.people} className="flex items-center justify-between px-3 py-3 border-b border-sand last:border-0"><div className="flex items-center gap-3"><span className={cx("w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold",i===0?"bg-clay text-white":"bg-paper border border-sand")}>{i+1}</span><div><p className="text-[14px] font-semibold leading-none">{c.people}</p><p className="text-[12px] text-stone2 mt-1">{c.dish}</p></div></div><span className="font-display font-bold">{c.elo}</span></div>)}</Card>
      <div className="space-y-3">{sorted.map((c:any,i:number)=><Card key={c.people} className="p-4"><div className="flex justify-between"><p className="font-semibold">{c.people}</p><span className="text-[12px] font-bold text-clay">{c.elo} pts</span></div><p className="font-display text-[18px] mt-0.5">{c.dish}</p><dl className="grid grid-cols-2 gap-x-3 gap-y-2 mt-3 text-[13px]"><div><dt className="text-stone2 text-[11px] uppercase font-bold">Rice</dt><dd>{c.rice}</dd></div><div><dt className="text-stone2 text-[11px] uppercase font-bold">Smoke</dt><dd>{c.smoke}</dd></div><div className="col-span-2"><dt className="text-stone2 text-[11px] uppercase font-bold">Base & secret</dt><dd>{c.tomatoBase} · {c.secret}</dd></div><div className="col-span-2"><dt className="text-stone2 text-[11px] uppercase font-bold">Technique</dt><dd>{c.technique}</dd></div></dl><div className="flex gap-2 mt-4"><button onClick={()=>setTab("Home")} className="flex-1 border border-sand rounded-full py-2.5 text-[13px] font-semibold bg-white flex items-center justify-center gap-1.5"><Clock size={14}/> Cook this</button><button onClick={()=>vote(i)} className="flex-1 bg-ink text-white rounded-full py-2.5 text-[13px] font-semibold">Vote for this style</button></div></Card>)}</div>
      <div><SectionTitle title="More battles"/><div className="space-y-2">{OTHER_BATTLES.map(b=><Card key={b.id} className="p-4 flex justify-between items-center"><div><p className="font-semibold text-[14px]">{b.title}</p><p className="text-[12px] text-stone2 mt-0.5">{b.items.join(" vs ")}</p></div><ChevronRight size={18} className="text-stone-400 shrink-0"/></Card>)}</div></div>
    </main>}

    {tab==="Circle"&&<main className="px-5 pt-5 space-y-5">
      <div><h1 className="font-display text-[26px] font-semibold">Pantry Circle</h1><p className="text-stone2 text-[14px]">Borrow from your village before you buy.</p></div>
      <button onClick={()=>setRequests([{user:"You",dist:"Now",item:`Looking for ${missing}`,time:"now"},...requests])} className="w-full bg-clay text-white py-3.5 rounded-full font-semibold text-[14px] flex items-center justify-center gap-2 shadow-card"><Plus size={16}/> Post a request</button>
      <div className="space-y-2">{requests.map((r,i)=><Card key={i} className="p-4 flex justify-between items-center"><div className="flex gap-3 items-center"><div className="w-10 h-10 rounded-full bg-paper border border-sand flex items-center justify-center font-display font-bold text-clay">{r.user[0]}</div><div><p className="text-[14px] font-semibold leading-none">{r.user} <span className="text-stone2 font-normal">· {r.dist}</span></p><p className="text-[13px] text-stone-600 mt-1">{r.item}</p></div></div><button className="px-3.5 py-2 rounded-full bg-ink text-white text-[12px] font-semibold shrink-0">Ask</button></Card>)}</div>
      <Card className="p-4 bg-[#F3F6EE] border-green-100"><p className="font-semibold text-[14px] flex items-center gap-2"><Phone size={14}/> How it works</p><p className="text-[13px] text-stone-600 mt-1 leading-relaxed">Neighbors list extras they’re willing to share. No payment in-app — just message, meet, and return the favor.</p></Card>
    </main>}

    {/* Bottom Nav - Production Pattern */}
    <nav className="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto bg-white/95 backdrop-blur border-t border-sand px-2 pt-2 pb-[max(12px,env(safe-area-inset-bottom))] flex justify-around z-20">
      {([["Home",Home],["Scan",Camera],["Explore",Globe2],["Battles",Swords],["Circle",Users]] as const).map(([t,Icon])=><button key={t} onClick={()=>setTab(t as Tab)} className={cx("flex flex-col items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-medium",tab===t?"text-clay":"text-stone-400")}><Icon size={20} strokeWidth={tab===t?2.4:1.8}/>{t}</button>)}
    </nav>
  </div>);
}