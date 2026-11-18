(() => {
  "use strict";
  const landingPage = document.querySelector("#home");
  if (landingPage) {
    const menuToggle = document.querySelector(".menu-toggle");
    const navMenu = document.querySelector(".nav-menu");
    const loginButton = document.querySelector(".login-button");
    const currentYear = document.querySelector("#current-year");
    const revealElements = [...document.querySelectorAll(".reveal")];
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (currentYear) currentYear.textContent = String(new Date().getFullYear());

    if (menuToggle && navMenu) {
      menuToggle.addEventListener("click", () => {
        const expanded = menuToggle.getAttribute("aria-expanded") === "true";
        menuToggle.setAttribute("aria-expanded", String(!expanded));
        menuToggle.setAttribute("aria-label", expanded ? "Open navigation menu" : "Close navigation menu");
        navMenu.classList.toggle("is-open", !expanded);
      });

      navMenu.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => {
          menuToggle.setAttribute("aria-expanded", "false");
          menuToggle.setAttribute("aria-label", "Open navigation menu");
          navMenu.classList.remove("is-open");
        });
      });
    }

    if (loginButton) {
      loginButton.addEventListener("click", () => {
        window.alert("The login system is not available yet. Please check back later.");
      });
    }

    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      revealElements.forEach((element) => element.classList.add("is-visible"));
    } else {
      document.documentElement.classList.add("has-reveal");
      const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12 });

      revealElements.forEach((element) => revealObserver.observe(element));
    }
    return;
  }

  const STORAGE_KEY = "sportshub-demo-v1";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const today = () => new Date().toISOString().slice(0, 10);
  const dateOffset = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
  const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const safe = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const fmtDate = (date) => { if (!date) return "—"; const d = new Date(`${date}T00:00:00`); return Number.isNaN(d.getTime()) ? safe(date) : d.toLocaleDateString(undefined, {month:"short",day:"numeric",year:"numeric"}); };
  const seed = {
    equipment: [
      {id:uid(),name:"Basketball",category:"Ball sports",location:"Equipment room A",quantity:12,condition:"Good",status:"Available"},
      {id:uid(),name:"Badminton racket",category:"Racket sports",location:"Equipment room B",quantity:16,condition:"Good",status:"Available"},
      {id:uid(),name:"Training cones",category:"Training gear",location:"Storage cabinet 1",quantity:30,condition:"Fair",status:"Available"},
      {id:uid(),name:"Volleyball net",category:"Court equipment",location:"Main gym",quantity:2,condition:"Good",status:"Available"},
      {id:uid(),name:"Table tennis paddle",category:"Racket sports",location:"Equipment room B",quantity:10,condition:"Fair",status:"Available"},
      {id:uid(),name:"Resistance bands",category:"Training gear",location:"Fitness room",quantity:14,condition:"Good",status:"Available"}
    ],
    facilities: [
      {id:uid(),name:"Main Basketball Court",activity:"Team practice",date:dateOffset(0),start:"15:00",end:"17:00",organizer:"Basketball team",status:"Scheduled"},
      {id:uid(),name:"Badminton Court A",activity:"Club training",date:dateOffset(1),start:"09:00",end:"11:00",organizer:"Badminton club",status:"Scheduled"},
      {id:uid(),name:"Fitness Room",activity:"Strength session",date:dateOffset(2),start:"13:00",end:"14:30",organizer:"Coaching staff",status:"Scheduled"}
    ],
    loans: [
      {id:uid(),equipmentId:null,itemName:"Basketball",borrower:"Jordan Reyes",dateBorrowed:dateOffset(-1),dueDate:dateOffset(1),quantity:2,status:"Borrowed"}
    ],
    maintenance: [
      {id:uid(),itemName:"Training cones",location:"Storage cabinet 1",issue:"Several cones are worn and need inspection.",priority:"Medium",dateReported:dateOffset(-2),status:"Open"}
    ],
    admin: false
  };
  let data = loadData();
  let currentPage = "home";
  let currentRecordType = "";
  let editingId = null;
  let toastTimer;

  function loadData() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return structuredClone(seed);
      const parsed = JSON.parse(saved);
      return { ...structuredClone(seed), ...parsed,
        equipment: Array.isArray(parsed.equipment) ? parsed.equipment : [],
        facilities: Array.isArray(parsed.facilities) ? parsed.facilities : [],
        loans: Array.isArray(parsed.loans) ? parsed.loans : [],
        maintenance: Array.isArray(parsed.maintenance) ? parsed.maintenance : [] };
    } catch (error) { console.warn("Could not load saved demo data:", error); return structuredClone(seed); }
  }
  function saveData() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
    catch (error) { showToast("Could not save. Browser storage may be full or disabled."); }
  }
  function showToast(message) {
    const toast = $("#toast"); toast.textContent = message; toast.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
  }
  function badge(status) {
    const cls = /maintenance|open|overdue|high|damaged/i.test(status) ? "danger" : /borrowed|fair|medium|scheduled/i.test(status) ? "warn" : /completed|returned|resolved|available|good/i.test(status) ? "" : "neutral";
    return `<span class="pill ${cls}">${safe(status)}</span>`;
  }
  function iconFor(category) {
    const c = (category || "").toLowerCase();
    if (c.includes("ball")) return "◉"; if (c.includes("racket")) return "⌁"; if (c.includes("training")) return "▥";
    if (c.includes("court")) return "▦"; return "▣";
  }
  function navTo(page) {
    if (!["home","inventory","schedule","borrowing","maintenance"].includes(page)) return;
    currentPage = page;
    $$(".page").forEach(el => el.classList.toggle("active", el.id === `page-${page}`));
    $$(".nav-item[data-page]").forEach(el => el.classList.toggle("active", el.dataset.page === page));
    $("#breadcrumbPage").textContent = ({home:"Overview",inventory:"Equipment inventory",schedule:"Facility schedules",borrowing:"Borrowing & returns",maintenance:"Maintenance"})[page];
    $("#sidebar").classList.remove("open");
    renderPage(page);
    window.scrollTo({top:0,behavior:"smooth"});
  }
  function renderPage(page) {
    renderStats();
    if (page === "home") renderRecent();
    if (page === "inventory") renderInventory();
    if (page === "schedule") renderSchedules();
    if (page === "borrowing") renderLoans();
    if (page === "maintenance") renderMaintenance();
  }
  function renderStats() {
    $("#statEquipment").textContent = data.equipment.reduce((n,e)=>n+Number(e.quantity||0),0);
    $("#statAvailable").textContent = data.equipment.filter(e=>e.status==="Available").reduce((n,e)=>n+Number(e.quantity||0),0);
    $("#statFacilities").textContent = new Set(data.facilities.map(f=>f.name)).size;
    $("#statMaintenance").textContent = data.maintenance.filter(m=>m.status!=="Resolved").length;
    $("#todayChip").textContent = new Date().toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"}).toUpperCase();
    $("#sideUserName").textContent = data.admin ? "Sports Admin" : "Club Admin";
    $("#sideUserRole").textContent = data.admin ? "Administrator · Demo" : "Demo workspace";
    $("#logoutBtn").classList.toggle("hidden",!data.admin);
  }
  function renderRecent() {
    const items = [...data.equipment].slice(0,5);
    $("#recentEquipment").innerHTML = items.length ? items.map(e=>`<tr><td><div class="item-cell"><span class="item-symbol">${iconFor(e.category)}</span><span><strong>${safe(e.name)}</strong><span class="item-sub">${safe(e.location)}</span></span></div></td><td>${safe(e.category)}</td><td>${badge(e.condition)}</td><td>${badge(e.status)}</td></tr>`).join("") : `<tr><td colspan="4">No equipment records yet.</td></tr>`;
  }
  function renderInventory() {
    const search = ($("#inventorySearch").value||"").trim().toLowerCase();
    const category = $("#inventoryCategory").value, status = $("#inventoryStatus").value;
    const categories = [...new Set(data.equipment.map(e=>e.category).filter(Boolean))].sort();
    const select = $("#inventoryCategory"), prior = select.value;
    select.innerHTML = `<option value="">All categories</option>` + categories.map(c=>`<option value="${safe(c)}">${safe(c)}</option>`).join("");
    if (categories.includes(prior)) select.value = prior;
    const filtered = data.equipment.filter(e => [e.name,e.category,e.location,e.condition].some(v=>String(v||"").toLowerCase().includes(search)) && (!category||e.category===category) && (!status||e.status===status));
    $("#inventoryRows").innerHTML = filtered.map(e=>`<tr><td><div class="item-cell"><span class="item-symbol">${iconFor(e.category)}</span><span><strong>${safe(e.name)}</strong><span class="item-sub">ID: ${safe(e.id.slice(-6).toUpperCase())}</span></span></div></td><td>${safe(e.category)}</td><td>${safe(e.location)}</td><td>${safe(e.quantity)}</td><td>${badge(e.condition)}</td><td>${badge(e.status)}</td><td><div class="row-actions"><button class="small-action" data-edit="equipment" data-id="${e.id}">Edit</button><button class="small-action danger-action" data-delete="equipment" data-id="${e.id}">Delete</button></div></td></tr>`).join("");
    $("#inventoryEmpty").classList.toggle("hidden",filtered.length>0);
  }
  function renderSchedules() {
    const search = ($("#scheduleSearch").value||"").trim().toLowerCase(), status = $("#scheduleStatus").value;
    const rows = data.facilities.filter(f=>[f.name,f.activity,f.organizer].some(v=>String(v||"").toLowerCase().includes(search))&&(!status||f.status===status)).sort((a,b)=>a.date.localeCompare(b.date));
    $("#scheduleCards").innerHTML = rows.map(f=>`<article class="schedule-card"><div class="card-top"><div><div class="card-category">FACILITY BOOKING</div><h3>${safe(f.name)}</h3><div class="card-muted">${safe(f.activity)}</div></div>${badge(f.status)}</div><div class="card-meta"><span>▣ ${fmtDate(f.date)}</span><span>◷ ${safe(f.start)} – ${safe(f.end)}</span><span>♙ ${safe(f.organizer)}</span></div><div class="card-actions"><button class="small-action" data-edit="facility" data-id="${f.id}">Edit schedule</button><button class="small-action danger-action" data-delete="facility" data-id="${f.id}">Delete</button></div></article>`).join("");
    $("#scheduleEmpty").classList.toggle("hidden",rows.length>0);
  }
  function isOverdue(loan) { return loan.status==="Borrowed" && loan.dueDate && loan.dueDate < today(); }
  function renderLoans() {
    const active = data.loans.filter(l=>l.status==="Borrowed");
    $("#loanActiveCount").textContent = active.length;
    $("#loanReturnedCount").textContent = data.loans.filter(l=>l.status==="Returned").length;
    $("#loanOverdueCount").textContent = active.filter(isOverdue).length;
    $("#borrowingRows").innerHTML = data.loans.map(l=>`<tr><td><strong>${safe(l.itemName)}</strong></td><td>${safe(l.borrower)}</td><td>${fmtDate(l.dateBorrowed)}</td><td>${fmtDate(l.dueDate)} ${isOverdue(l)?'<span class="pill danger">Overdue</span>':""}</td><td>${safe(l.quantity)}</td><td>${badge(l.status)}</td><td><div class="row-actions">${l.status==="Borrowed"?`<button class="small-action" data-return="${l.id}">Mark returned</button>`:"—"}<button class="small-action danger-action" data-delete="loan" data-id="${l.id}">Delete</button></div></td></tr>`).join("");
    $("#borrowingEmpty").classList.toggle("hidden",data.loans.length>0);
  }
  function renderMaintenance() {
    $("#maintAllCount").textContent = data.maintenance.length;
    $("#maintOpenCount").textContent = data.maintenance.filter(m=>m.status!=="Resolved").length;
    $("#maintResolvedCount").textContent = data.maintenance.filter(m=>m.status==="Resolved").length;
    $("#maintenanceCards").innerHTML = data.maintenance.map(m=>`<article class="maintenance-card"><div class="card-top"><div><div class="card-category">MAINTENANCE REPORT · ${safe(m.priority.toUpperCase())} PRIORITY</div><h3>${safe(m.itemName)}</h3></div>${badge(m.status)}</div><div class="card-muted">⌖ ${safe(m.location)} · Reported ${fmtDate(m.dateReported)}</div><p class="issue-description">${safe(m.issue)}</p><div class="card-actions">${m.status!=="Resolved"?`<button class="small-action" data-resolve="${m.id}">Mark resolved</button>`:`<button class="small-action" data-reopen="${m.id}">Reopen issue</button>`}<button class="small-action" data-edit="maintenance" data-id="${m.id}">Edit</button><button class="small-action danger-action" data-delete="maintenance" data-id="${m.id}">Delete</button></div></article>`).join("");
    $("#maintenanceEmpty").classList.toggle("hidden",data.maintenance.length>0);
  }
  const field = (name,label,type="text",options=null,required=true,full=false,placeholder="") => ({name,label,type,options,required,full,placeholder});
  const schemas = {
    equipment: {title:"EQUIPMENT RECORD",collection:"equipment",fields:[
      field("name","Equipment name","text",null,true,false,"e.g. Basketball"),
      field("category","Category","select",["Ball sports","Racket sports","Training gear","Court equipment","Fitness equipment","Other"]),
      field("location","Storage location","text",null,true,false,"e.g. Equipment room A"),
      field("quantity","Quantity","number",null,true,false,"Enter quantity"),
      field("condition","Condition","select",["Good","Fair","Damaged"]),
      field("status","Availability","select",["Available","Borrowed","Maintenance"])
    ]},
    facility: {title:"FACILITY SCHEDULE",collection:"facilities",fields:[
      field("name","Facility name","text",null,true,false,"e.g. Main Basketball Court"),
      field("activity","Activity / purpose","text",null,true,false,"e.g. Team practice"),
      field("date","Date","date"),
      field("start","Start time","time"),
      field("end","End time","time"),
      field("organizer","Organizer","text",null,true,false,"Team or staff member"),
      field("status","Schedule status","select",["Scheduled","Completed","Cancelled"])
    ]},
    loan: {title:"BORROWING RECORD",collection:"loans",fields:[
      field("itemName","Equipment item","select",[],true,true),
      field("borrower","Borrower name","text",null,true,false,"Full name"),
      field("dateBorrowed","Date borrowed","date"),
      field("dueDate","Due date","date"),
      field("quantity","Quantity borrowed","number",null,true,false,"Enter quantity")
    ]},
    maintenance: {title:"MAINTENANCE REPORT",collection:"maintenance",fields:[
      field("itemName","Equipment / resource","text",null,true,false,"e.g. Volleyball net"),
      field("location","Location","text",null,true,false,"Where is the issue?"),
      field("priority","Priority","select",["Low","Medium","High"]),
      field("dateReported","Date reported","date"),
      field("status","Issue status","select",["Open","In progress","Resolved"]),
      field("issue","Issue description","textarea",null,true,true,"Describe the damage or maintenance needed")
    ]}
  };
  function openRecord(type,id=null) {
    if (!data.admin) { openLogin(); showToast("Sign in with the demo admin account to manage records."); return; }
    const schema = schemas[type]; if (!schema) return;
    currentRecordType = type; editingId = id;
    const existing = id ? data[schema.collection].find(x=>x.id===id) : {};
    $("#modalTitle").textContent = id ? `EDIT ${schema.title}` : `ADD ${schema.title}`;
    $("#modalFields").innerHTML = schema.fields.map(f => {
      let control = "";
      const val = existing?.[f.name] ?? (f.name==="quantity" ? "1" : f.name==="date"||f.name==="dateBorrowed"||f.name==="dateReported" ? today() : f.name==="dueDate" ? dateOffset(7) : f.name==="condition" ? "Good" : f.name==="status" ? (type==="facility"?"Scheduled":type==="maintenance"?"Open":"Available") : f.name==="priority" ? "Medium" : f.name==="start" ? "09:00" : f.name==="end" ? "10:00" : "");
      if (f.type==="select") {
        let options = f.options || [];
        if (f.name==="itemName") options = [...new Set(data.equipment.map(e=>e.name))];
        control = `<select name="${f.name}" ${f.required?"required":""}>${options.map(o=>`<option value="${safe(o)}" ${String(o)===String(val)?"selected":""}>${safe(o)}</option>`).join("")}</select>`;
      } else if (f.type==="textarea") control = `<textarea name="${f.name}" placeholder="${safe(f.placeholder)}" ${f.required?"required":""}>${safe(val)}</textarea>`;
      else control = `<input name="${f.name}" type="${f.type}" value="${safe(val)}" placeholder="${safe(f.placeholder)}" ${f.required?"required":""} ${f.type==="number"?'min="1"':''}>`;
      return `<div class="field ${f.full?"full":""}"><label for="field-${f.name}">${safe(f.label)}</label>${control.replace(`name="${f.name}"`,`id="field-${f.name}" name="${f.name}"`)}</div>`;
    }).join("");
    $("#modalBackdrop").classList.remove("hidden");
    const first = $("#modalFields input, #modalFields select, #modalFields textarea"); if(first) first.focus();
  }
  function closeRecord() { $("#modalBackdrop").classList.add("hidden"); $("#recordForm").reset(); currentRecordType=""; editingId=null; }
  function handleRecordSubmit(event) {
    event.preventDefault(); const schema=schemas[currentRecordType]; if(!schema) return;
    const formData = new FormData(event.currentTarget); const record = {};
    schema.fields.forEach(f=>record[f.name]=String(formData.get(f.name)||"").trim());
    if (["quantity"].includes("quantity") && currentRecordType==="equipment") record.quantity = Math.max(1,Number(record.quantity)||1);
    if (currentRecordType==="loan") {
      record.quantity = Math.max(1,Number(record.quantity)||1); record.status = "Borrowed";
      const eq = data.equipment.find(e=>e.name===record.itemName);
      if (!eq) { showToast("Add equipment to inventory before recording a loan."); return; }
      record.equipmentId = eq.id;
      if (eq.status==="Maintenance") { showToast("This equipment is marked for maintenance."); return; }
      const currentlyBorrowed = data.loans.filter(l=>l.equipmentId===eq.id && l.status==="Borrowed").reduce((n,l)=>n+Number(l.quantity),0);
      if (record.quantity + currentlyBorrowed > Number(eq.quantity)) { showToast("Loan quantity is greater than the recorded stock."); return; }
      eq.status = record.quantity + currentlyBorrowed >= Number(eq.quantity) ? "Borrowed" : eq.status;
    }
    if (currentRecordType==="equipment" && record.status==="Maintenance") {
      // Equipment status can be managed independently of maintenance reports.
    }
    if (currentRecordType==="facility" && record.end <= record.start) { showToast("End time must be later than start time."); return; }
    const list = data[schema.collection];
    if (editingId) {
      const index=list.findIndex(x=>x.id===editingId); if(index>=0) list[index]={...list[index],...record};
      showToast("Record updated successfully.");
    } else {
      record.id=uid(); if(currentRecordType==="loan") record.status="Borrowed";
      list.unshift(record); showToast("Record added successfully.");
    }
    saveData(); closeRecord(); renderPage(currentPage);
  }
  function openLogin() {
    $("#loginBackdrop").classList.remove("hidden"); $("#loginError").classList.add("hidden");
    $("#loginUsername").focus();
  }
  function closeLogin() { $("#loginBackdrop").classList.add("hidden"); $("#loginForm").reset(); }
  function login(event) {
    event.preventDefault();
    if ($("#loginUsername").value.trim()==="admin" && $("#loginPassword").value==="sports123") {
      data.admin=true; saveData(); closeLogin(); renderStats(); showToast("Demo admin access enabled.");
    } else { $("#loginError").classList.remove("hidden"); }
  }
  function logout() { data.admin=false; saveData(); renderStats(); showToast("Signed out of demo admin access."); }
  function deleteRecord(type,id) {
    if (!data.admin) { openLogin(); return; }
    const map={equipment:"equipment",facility:"facilities",loan:"loans",maintenance:"maintenance"};
    const collection=map[type]; if(!collection) return;
    const record=data[collection].find(x=>x.id===id);
    if(!record || !confirm(`Delete "${record.name||record.itemName||"this record"}"? This cannot be undone.`)) return;
    data[collection]=data[collection].filter(x=>x.id!==id);
    saveData(); renderPage(currentPage); showToast("Record deleted.");
  }
  function markReturned(id) {
    if (!data.admin) { openLogin(); return; }
    const loan=data.loans.find(l=>l.id===id); if(!loan) return;
    loan.status="Returned";
    const activeSameItem=data.loans.some(l=>l.id!==id&&l.equipmentId===loan.equipmentId&&l.status==="Borrowed");
    const eq=data.equipment.find(e=>e.id===loan.equipmentId);
    if(eq && !activeSameItem && eq.status==="Borrowed") eq.status="Available";
    saveData(); renderPage(currentPage); showToast("Equipment return recorded.");
  }
  function setMaintenanceStatus(id,status) {
    if(!data.admin) { openLogin(); return; }
    const m=data.maintenance.find(x=>x.id===id); if(!m)return;
    m.status=status; saveData(); renderPage(currentPage); showToast(`Maintenance marked ${status.toLowerCase()}.`);
  }
  function quickAction(action) {
    const map={"add-equipment":"equipment","add-booking":"facility","add-borrow":"loan","add-maintenance":"maintenance"};
    if(map[action]) openRecord(map[action]);
  }
  document.addEventListener("click",event=>{
    const nav=event.target.closest("[data-page]"); if(nav){event.preventDefault();navTo(nav.dataset.page);return;}
    const quick=event.target.closest("[data-action]"); if(quick){quickAction(quick.dataset.action);return;}
    const edit=event.target.closest("[data-edit]"); if(edit){openRecord(edit.dataset.edit,edit.dataset.id);return;}
    const del=event.target.closest("[data-delete]"); if(del){deleteRecord(del.dataset.delete,del.dataset.id);return;}
    const ret=event.target.closest("[data-return]"); if(ret){markReturned(ret.dataset.return);return;}
    const res=event.target.closest("[data-resolve]"); if(res){setMaintenanceStatus(res.dataset.resolve,"Resolved");return;}
    const reopen=event.target.closest("[data-reopen]"); if(reopen){setMaintenanceStatus(reopen.dataset.reopen,"Open");return;}
  });
  $("#menuBtn").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
  $("#adminNav").addEventListener("click",openLogin); $("#topAdminBtn").addEventListener("click",openLogin);
  $("#logoutBtn").addEventListener("click",logout);
  $("#closeModal").addEventListener("click",closeRecord); $("#cancelModal").addEventListener("click",closeRecord);
  $("#modalBackdrop").addEventListener("click",e=>{if(e.target===$("#modalBackdrop"))closeRecord();});
  $("#closeLogin").addEventListener("click",closeLogin);
  $("#loginBackdrop").addEventListener("click",e=>{if(e.target===$("#loginBackdrop"))closeLogin();});
  $("#recordForm").addEventListener("submit",handleRecordSubmit); $("#loginForm").addEventListener("submit",login);
  $("#inventorySearch").addEventListener("input",renderInventory); $("#inventoryCategory").addEventListener("change",renderInventory); $("#inventoryStatus").addEventListener("change",renderInventory);
  $("#scheduleSearch").addEventListener("input",renderSchedules); $("#scheduleStatus").addEventListener("change",renderSchedules);
  document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeRecord();closeLogin();$("#sidebar").classList.remove("open");}});
  $("#todayChip").textContent=new Date().toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"}).toUpperCase();
  renderPage("home");
})();