(function(){
  // ---------- Helpers ----------
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const toast = (msg)=>{ const t=$("#toast"); t.textContent=msg; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),1600); };

  // ---------- Tabs ----------
  const tabs = $("#tabs");
  const sections = {
    checkin: $("#tab-checkin"),
    breath: $("#tab-breath"),
    mind: $("#tab-mind"),
    body: $("#tab-body"),
    plan: $("#tab-plan")
  };
  tabs.addEventListener("click", (e)=>{
    if(!e.target.matches(".tab")) return;
    $$(".tab").forEach(b=>b.classList.remove("active"));
    e.target.classList.add("active");
    const t = e.target.dataset.tab;
    Object.keys(sections).forEach(k=>sections[k].style.display = k===t ? "block":"none");
  });

  // ---------- Streak ----------
  const LS = "holistica.data.v1";
  const data = JSON.parse(localStorage.getItem(LS)||'{"streak":0,"last":"", "log":[]}');
  const today = new Date().toISOString().slice(0,10);
  const setStreak = (inc=false)=>{
    if(inc){
      if(data.last===today){ /* no change */ }
      else{
        const d1 = new Date(data.last||today); const d2 = new Date(today);
        const diff = Math.round((d2-d1)/86400000);
        data.streak = (diff===1 || data.streak===0)? data.streak+1 : 1;
        data.last = today;
        localStorage.setItem(LS, JSON.stringify(data));
      }
    }
    $("#streak").textContent = data.streak||0;
  };
  setStreak(false);

  // ---------- Check-in ----------
  const sliders = [
    {id:"r-energia", meter:"#m-energia", good:true},
    {id:"r-animo", meter:"#m-animo", good:true},
    {id:"r-estres", meter:"#m-estres", good:false},
    {id:"r-tension", meter:"#m-tension", good:false},
  ];
  const tags = $("#tags");
  function recompute(){
    const vals = {};
    sliders.forEach(s=>{
      const v = +$("#"+s.id).value;
      $(s.meter).style.width = (v*10)+"%";
      vals[s.id]=v;
    });
    const energia=vals["r-energia"], animo=vals["r-animo"], estres=vals["r-estres"], tension=vals["r-tension"];
    let rec=[], chips=[];
    if(estres>=6 || tension>=6) {rec.push("👉 Prueba 5 min de respiración 4-4-6 y un recorrido corporal (3 zonas)."); chips.push("Respirar 4-4-6","Relajar 3 zonas");}
    if(energia<=4) {rec.push("⚡ Camina 10–15 min o estiramiento suave antes de mindfulness."); chips.push("Caminar 15 min");}
    if(animo<=4) {rec.push("💛 Registro de gratitud: 3 ítems hoy + contacto social breve."); chips.push("Gratitud x3","Mensaje a alguien");}
    if(rec.length===0){rec.push("¡Vas bien! Mantén 5–10 min de mindfulness y 20–30 min de movimiento hoy."); chips.push("Mindfulness 10","Movimiento 20–30");}
    $("#rec").textContent = rec.join(" ");
    tags.innerHTML = chips.map(c=>`<span class="pill ok">${c}</span>`).join(" ");
  }
  sliders.forEach(s=> $("#"+s.id).addEventListener("input",recompute));
  recompute();

  $("#saveCheckin").addEventListener("click", ()=>{
    const entry = {
      date: today,
      energia:+$("#r-energia").value,
      animo:+$("#r-animo").value,
      estres:+$("#r-estres").value,
      tension:+$("#r-tension").value
    };
    data.log.push(entry);
    localStorage.setItem(LS, JSON.stringify(data));
    setStreak(true);
    toast("Check-in guardado");
  });

  $("#doQuick").addEventListener("click", ()=>{
    // Quick routine: 1 min breath + 2 zones scan + 2 min mindfulness
    $$(".tab").forEach(t=>t.classList.remove("active"));
    $(`.tab[data-tab="breath"]`).classList.add("active");
    Object.keys(sections).forEach(k=>sections[k].style.display = k==="breath" ? "block":"none");
    startBreathing();
    setTimeout(()=>{ stopBreathing(); }, 60000);
    toast("Rutina rápida iniciada");
  });

  // ---------- Breathing ----------
  const circle = $("#circle"), coach = $("#coach");
  const breathMode = $("#breathMode");
  const startBreath = $("#startBreath"), stopBreath = $("#stopBreath"), oneMinute=$("#oneMinute");
  let breathTimer=null, breathClock=null, breathMinutes=0, phaseIdx=0, phases=[], labels=[];
  function parseMode(){
    const m = breathMode.value;
    if(m==="4-4-6"){ phases=[4,4,6]; labels=["Inhala","Mantén","Exhala"]; }
    else if(m==="4-4-4-4"){ phases=[4,4,4,4]; labels=["Inhala","Mantén","Exhala","Mantén"]; }
    else { phases=[7,11]; labels=["Inhala","Exhala"]; }
  }
  parseMode();
  let running=false;
  function tickPhase(){
    const label = labels[phaseIdx%labels.length];
    coach.textContent = label + "…";
    if(label.startsWith("Inhala")) circle.style.transform="scale(1.25)";
    else if(label.startsWith("Exhala")) circle.style.transform="scale(0.85)";
    else circle.style.transform="scale(1.05)";
    clearTimeout(breathTimer);
    breathTimer = setTimeout(()=>{ phaseIdx++; tickPhase(); }, phases[phaseIdx%phases.length]*1000);
  }
  function startBreathing(){
    if(running) return;
    running=true; parseMode(); phaseIdx=0; tickPhase();
    breathClock = setInterval(()=>{ breathMinutes++; $("#breathTime").textContent = Math.floor(breathMinutes/60); }, 1000);
  }
  function stopBreathing(){
    running=false; clearTimeout(breathTimer); clearInterval(breathClock);
    circle.style.transform="scale(1)"; coach.textContent="Listo";
    if(breathMinutes>=60){ setStreak(true); toast("Sesión de respiración registrada"); }
    breathMinutes=0; $("#breathTime").textContent="0";
  }
  startBreath.addEventListener("click", startBreathing);
  stopBreath.addEventListener("click", stopBreathing);
  oneMinute.addEventListener("click", ()=>{ setTimeout(()=>stopBreathing(), 60000); toast("+1 minuto"); });
  breathMode.addEventListener("change", ()=>{ if(running){ parseMode(); } });

  // ---------- Mindfulness Timer ----------
  const bell = new (window.AudioContext||window.webkitAudioContext)();
  function ring(){
    const o = bell.createOscillator(); const g = bell.createGain();
    o.type="sine"; o.frequency.value=660;
    o.connect(g); g.connect(bell.destination);
    g.gain.setValueAtTime(0.0001, bell.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, bell.currentTime+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, bell.currentTime+0.8);
    o.start(); o.stop(bell.currentTime+0.85);
  }
  const mindDur=$("#mindDur"), mindDurLabel=$("#mindDurLabel"), timer=$("#timer");
  let totalSec=5*60, left=totalSec, tInt=null, paused=true;
  function fmt(s){ const m=String(Math.floor(s/60)).padStart(2,"0"); const ss=String(s%60).padStart(2,"0"); return `${m}:${ss}`; }
  function setDur(min){ totalSec=min*60; left=totalSec; timer.textContent=fmt(left); }
  mindDur.addEventListener("input",()=>{ mindDurLabel.textContent=mindDur.value; setDur(+mindDur.value); });
  $("#startMind").addEventListener("click",()=>{
    if($("#bell").checked) try{ ring(); }catch(e){}
    if(tInt) clearInterval(tInt);
    paused=false;
    tInt=setInterval(()=>{
      if(paused) return;
      left--; timer.textContent=fmt(left);
      if(left<=0){ clearInterval(tInt); if($("#bell").checked) try{ ring(); }catch(e){}; setStreak(true); toast("Sesión mindfulness registrada"); left=0; }
    },1000);
  });
  $("#pauseMind").addEventListener("click",()=>{ paused=!paused; toast(paused?"Pausado":"Reanudado"); });
  $("#resetMind").addEventListener("click",()=>{ clearInterval(tInt); setDur(+mindDur.value); paused=true; });

  // ---------- Body Scan ----------
  const zones = $$("input[type=checkbox][data-zone]");
  function updateScan(){
    const done = zones.filter(z=>z.checked).length;
    const pct = Math.round(done/zones.length*100);
    $("#scanProg").style.width=pct+"%";
    $("#scanPct").textContent=pct;
    if(done===zones.length){ setStreak(true); toast("Recorrido corporal completado"); }
    const next = zones.find(z=>!z.checked);
    $("#scanTip").innerHTML = next ? `Siguiente zona sugerida: <strong>${next.dataset.zone}</strong>` : "¡Excelente! Observa tu respiración 60 s más.";
  }
  zones.forEach(z=>z.addEventListener("change",updateScan));

  // ---------- Plan 7 días ----------
  const week=$("#week");
  const days=["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
  days.forEach((d,i)=>{
    const el=document.createElement("button");
    el.className="btn secondary";
    el.style.padding="10px 8px"; el.style.fontWeight="700"; el.style.borderRadius="12px";
    el.textContent=d; el.dataset.on="0";
    el.addEventListener("click",(e)=>{
      e.preventDefault();
      const on=el.dataset.on==="1"; el.dataset.on= on?"0":"1";
      el.style.background = on?"#f1f5f9":"#22c55e"; el.style.color = on?"#0f172a":"#fff";
      if(!on) setStreak(true);
    });
    week.appendChild(el);
  });

  // ---------- Export / Print / Reset ----------
  $("#export").addEventListener("click", ()=>{
    const s = (id)=>+$(id).value;
    const text = [
      "INFORME – Psicología Holística (auto-registro)",
      new Date().toLocaleString(),
      "",
      `Check-in: Energía ${s("#r-energia")}/10, Ánimo ${s("#r-animo")}/10, Estrés ${s("#r-estres")}/10, Tensión ${s("#r-tension")}/10`,
      `Plan 7 días (hora sugerida ${$("#planHour").value})`,
      `Hábitos elegidos: ${$$(".habit:checked").map(h=>h.value).join(", ") || "—"}`,
      `Racha actual: ${$("#streak").textContent} días`,
      "Nota: esta herramienta es educativa y no reemplaza evaluación clínica."
    ].join("\n");
    navigator.clipboard.writeText(text).then(()=>toast("Informe copiado"));
  });
  $("#print").addEventListener("click",()=>window.print());
  $("#reset").addEventListener("click",()=>{
    localStorage.removeItem(LS); location.reload();
  });

  // ---------- Habits store ----------
  $$(".habit").forEach(h=>{
    h.addEventListener("change", ()=>{
      const sel = $$(".habit:checked").length;
      if(sel>3){ h.checked=false; toast("Máximo 3 hábitos a la vez"); }
    });
  });
})();
