// =======================
// dataStorage.js (Mini-CRM)
// =======================

// ---------- Low-level storage ----------
function getLeads() {
  return JSON.parse(localStorage.getItem("leadList") || "[]");
}
function saveLeads(leads) {
  localStorage.setItem("leadList", JSON.stringify(leads));
}

function getCustomers() {
  return JSON.parse(localStorage.getItem("customerDataList") || "[]");
}
function saveCustomers(list) {
  localStorage.setItem("customerDataList", JSON.stringify(list));
}

// ---------- Helpers ----------
function isValidEmail(mail) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail);
}

// ---------- Leads ----------
function addLead(lead) {
  if (!lead.firstName || !lead.lastName || !isValidEmail(lead.email)) {
    alert("Bitte Vorname, Nachname und eine gültige E-Mail eingeben.");
    return;
  }
  const leads = getLeads();
  if (leads.some(l => (l.email || "").toLowerCase() === lead.email.toLowerCase())) {
    alert("Diese E-Mail hat bereits angefragt.");
    return;
  }
  leads.push(lead);
  saveLeads(leads);
}

function deleteLead(index) {
  const leads = getLeads();
  leads.splice(index, 1);
  saveLeads(leads);
}

function promoteLeadToCustomer(index) {
  const leads = getLeads();
  const lead = leads[index];
  if (!lead) { alert("Lead nicht gefunden."); return; }

  const customers = getCustomers();
  const newId = "C" + Date.now();

  const newCustomer = normalizeCustomer({
    id: newId,
    firstName: lead.firstName,
    lastName: lead.lastName,
    email: lead.email,
    paket: lead.paket || "",
    dateAdded: new Date().toLocaleString(),

    // evtl. vorhandene Lead-Felder übernehmen
    street: lead.street || "",
    zip: lead.zip || "",
    city: lead.city || "",
    country: lead.country || "",
    phone: lead.phone || "",
    instagram: lead.instagram || "",
    facebook: lead.facebook || "",
    linkedin: lead.linkedin || "",
    website: lead.website || "",
    notes: lead.notes || ""
  });

  customers.push(newCustomer);
  saveCustomers(customers);

  leads.splice(index, 1);
  saveLeads(leads);

  // Page-cross Highlight für Kundenliste
  localStorage.setItem('highlightCustomerId', newId);

  // History
  addHistory(newId, 'system', 'Von Lead zu Kunde konvertiert');

  alert("Lead wurde zu Kunde befördert.");
  return newId;
}

// Test-Reset (alles löschen)
function resetAll() {
  if (confirm("Wirklich alle Daten (Leads & Kunden) löschen?")) {
    localStorage.removeItem("leadList");
    localStorage.removeItem("customerDataList");
    localStorage.removeItem("counters");
    alert("Alles gelöscht.");
    location.reload();
  }
}

// ---------- Angebote ----------
function addOfferToCustomer(customerId, offer) {
  const customers = getCustomers();
  const idx = customers.findIndex(c => c.id === customerId);
  if (idx === -1) { alert("Kunde nicht gefunden."); return; }

  customers[idx].offers = customers[idx].offers || [];
  const newOffer = {
    id: "O" + Date.now(),
    status: "erstellt", // erstellt | akzeptiert
    createdAt: new Date().toLocaleString(),
    ...offer // {paket, preis, zahlplanText}
  };
  customers[idx].offers.push(newOffer);
  saveCustomers(customers);
  addHistory(customerId, 'system', `Angebot erstellt (${newOffer.paket || '-'}, ${newOffer.preis ?? '-'}€)`);
  return newOffer;
}

function setOfferAccepted(customerId, offerId, signatureDataUrl) {
  const customers = getCustomers();
  const c = customers.find(x => x.id === customerId);
  if (!c || !c.offers) return;
  const off = c.offers.find(o => o.id === offerId);
  if (!off) return;
  off.status = "akzeptiert";
  off.acceptedAt = new Date().toLocaleString();
  off.signature = signatureDataUrl || null; // DataURL (PNG)
  saveCustomers(customers);
  // History
  const paketTxt = off?.paket ? ` (${off.paket})` : "";
  addHistory(customerId, 'milestone', `Angebot${paketTxt} unterschrieben`);
}

// ---------- Rechnungen & Zähler ----------
function nextInvoiceNumber() {
  const year = new Date().getFullYear();
  const counters = JSON.parse(localStorage.getItem("counters") || "{}");
  const key = "inv_" + year;
  counters[key] = (counters[key] || 0) + 1;
  localStorage.setItem("counters", JSON.stringify(counters));
  const nr = String(counters[key]).padStart(4, "0");
  return `${year}-${nr}`;
}

function addInvoiceToCustomer(customerId, invoice) {
  const customers = getCustomers();
  const idx = customers.findIndex(c => c.id === customerId);
  if (idx === -1) { alert("Kunde nicht gefunden."); return; }

  customers[idx].invoices = customers[idx].invoices || [];
  const newInv = {
    id: "I" + Date.now(),
    number: nextInvoiceNumber(),
    createdAt: new Date().toLocaleString(),
    status: "offen",
    ...invoice // { offerId|null, title, amount, note }
  };
  customers[idx].invoices.push(newInv);
  saveCustomers(customers);
  addHistory(customerId, 'system', `Rechnung erstellt: ${newInv.number} – ${newInv.title || ''}`);

  return newInv;
}

function setInvoiceStatus(customerId, invoiceId, status) { // 'offen'|'bezahlt'
  const customers = getCustomers();
  const c = customers.find(x => x.id === customerId);
  if (!c) return;
  const inv = (c.invoices || []).find(i => i.id === invoiceId);
  if (!inv) return;

  inv.status = status;
  inv.paidAt = status === 'bezahlt' ? new Date().toISOString() : null;
  saveCustomers(customers);

  // History
  if (status === 'bezahlt') {
    addHistory(customerId, 'system', `Rechnung ${inv.number} als bezahlt markiert`);
  } else {
    addHistory(customerId, 'system', `Rechnung ${inv.number} wieder auf 'offen' gesetzt`);
  }
}

// Rechnungen pro Angebot (für 30/35/35-Buttons)
function getInvoicesByOffer(customerId, offerId) {
  const c = getCustomers().find(x => x.id === customerId);
  return (c?.invoices || []).filter(inv => inv.offerId === offerId);
}
function hasInvoiceWithTitle(customerId, offerId, titleStartsWith) {
  return getInvoicesByOffer(customerId, offerId)
    .some(inv => (inv.title || "").startsWith(titleStartsWith));
}

// ---------- Abonnements ----------
function addSubscriptionToCustomer(customerId, sub) {
  const customers = getCustomers();
  const c = customers.find(x => x.id === customerId);
  if (!c) { alert("Kunde nicht gefunden."); return; }
  c.subscriptions = c.subscriptions || [];
  const newSub = {
    id: "S" + Date.now(),
    title: sub.title,               // z.B. "SEO Betreuung"
    amount: Number(sub.amount || 0),
    interval: sub.interval || "monthly",
    nextDue: sub.nextDue || new Date().toISOString().slice(0, 10), // YYYY-MM-DD
    active: typeof sub.active === "boolean" ? sub.active : true,
    acceptedAt: sub.acceptedAt || null,
    signature: sub.signature || null
  };
  c.subscriptions.push(newSub);
  saveCustomers(customers);
  // History
  addHistory(customerId, 'system', `Abo angelegt: ${newSub.title} (${eur(newSub.amount)}/Monat), Start ${newSub.nextDue}`);

  return newSub;
}

function listSubscriptions(customerId) {
  const c = getCustomers().find(x => x.id === customerId);
  return c?.subscriptions || [];
}

function advanceNextDueMonthly(isoDate) {
  const d = new Date((isoDate || "").toString().slice(0, 10) + "T00:00:00");
  if (isNaN(d)) return new Date().toISOString().slice(0, 10);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

// Aus Abo eine Rechnung erzeugen
function createInvoiceFromSubscription(customerId, subId, noteExtra) {
  const customers = getCustomers();
  const c = customers.find(x => x.id === customerId);
  if (!c) { alert("Kunde nicht gefunden."); return; }
  const sub = (c.subscriptions || []).find(s => s.id === subId && s.active);
  if (!sub) { alert("Abo nicht gefunden/aktiv."); return; }

  const inv = addInvoiceToCustomer(c.id, {
    offerId: null,
    title: `${sub.title} – ${sub.nextDue.slice(0, 7)}`,
    amount: sub.amount,
    note: `Abo/Monat: ${sub.nextDue}. ${noteExtra || ""}`.trim()
  });

  sub.nextDue = advanceNextDueMonthly(sub.nextDue);
  saveCustomers(customers);

  // History
  addHistory(customerId, 'system', `Abo-Rechnung erstellt: ${inv.number} – ${inv.title}`);

  return { customer: c, sub, invoice: inv };
}

// ===== Projekte =====
function addProjectToCustomer(customerId, project) {
  const customers = getCustomers();
  const c = customers.find(x => x.id === customerId);
  if (!c) { alert('Kunde nicht gefunden.'); return; }
  c.projects = Array.isArray(c.projects) ? c.projects : [];

  const p = {
    id: 'P' + Date.now(),
    title: project.title || 'Neues Projekt',
    offerId: project.offerId || null,
    status: project.status || 'open', // open | onhold | done
    createdAt: new Date().toISOString(),
    milestones: Array.isArray(project.milestones) ? project.milestones : [],
    notes: project.notes || '',
    files: Array.isArray(project.files) ? project.files : []
  };

  c.projects.push(p);
  saveCustomers(customers);
  addHistory(customerId, 'milestone', `Projekt angelegt: ${p.title}`);
  return p;
}

function addProjectFromOffer(customerId, offerId) {
  const c = getCustomers().find(x => x.id === customerId);
  if (!c) return;
  const o = (c.offers || []).find(x => x.id === offerId);
  if (!o) { alert('Angebot nicht gefunden.'); return; }
  const title = o.paket ? `${o.paket} Projekt` : `Projekt zu Angebot ${o.id}`;
  return addProjectToCustomer(customerId, {
    title,
    offerId: o.id,
    milestones: [
      { id: 'M1', title: 'Kickoff', due: new Date().toISOString().slice(0, 10), done: false },
      { id: 'M2', title: 'Meilenstein 1', due: '', done: false },
      { id: 'M3', title: 'Abnahme', due: '', done: false }
    ]
  });
}

function updateProject(customerId, projectId, patch) {
  const customers = getCustomers();
  const c = customers.find(x => x.id === customerId); if (!c) return;
  c.projects = Array.isArray(c.projects) ? c.projects : [];
  const p = c.projects.find(x => x.id === projectId); if (!p) return;
  Object.assign(p, patch);
  saveCustomers(customers);
  return p;
}

function addProjectMilestone(customerId, projectId, title, due) {
  const customers = getCustomers();
  const c = customers.find(x => x.id === customerId); if (!c) return;
  const p = (c.projects || []).find(x => x.id === projectId); if (!p) return;
  p.milestones = Array.isArray(p.milestones) ? p.milestones : [];
  const m = { id: 'M' + Date.now(), title: String(title || 'Meilenstein'), due: due || '', done: false };
  p.milestones.push(m);
  saveCustomers(customers);
  addHistory(customerId, 'note', `Milestone hinzugefügt: ${m.title}`);
  return m;
}

function toggleMilestoneDone(customerId, projectId, milestoneId, done) {
  const customers = getCustomers();
  const c = customers.find(x => x.id === customerId); if (!c) return;
  const p = (c.projects || []).find(x => x.id === projectId); if (!p) return;
  const m = (p.milestones || []).find(x => x.id === milestoneId); if (!m) return;
  m.done = !!done;
  saveCustomers(customers);
  addHistory(customerId, 'milestone', `Milestone ${m.title} ${m.done ? 'abgehakt' : 'wieder geöffnet'}`);
}

function addProjectFile(customerId, projectId, file) {
  // vorerst nur Metadaten/Link
  const customers = getCustomers();
  const c = customers.find(x => x.id === customerId); if (!c) return;
  const p = (c.projects || []).find(x => x.id === projectId); if (!p) return;
  p.files = Array.isArray(p.files) ? p.files : [];
  const f = {
    id: 'F' + Date.now(),
    name: file.name || 'Datei',
    url: file.url || '',     // externer Link (Drive/Dropbox/etc.)
    size: file.size || 0,
    kind: file.kind || 'link',
    addedAt: new Date().toISOString()
  };
  p.files.push(f);
  saveCustomers(customers);
  addHistory(customerId, 'note', `Datei zum Projekt hinzugefügt: ${f.name}`);
  return f;
}

function updateSubscription(customerId, subId, patch) {
  const customers = getCustomers();
  const c = customers.find(x => x.id === customerId);
  if (!c) return;
  const s = (c.subscriptions || []).find(x => x.id === subId);
  if (!s) return;
  Object.assign(s, patch); // z.B. {active:false}
  saveCustomers(customers);
}

function setSubscriptionAccepted(customerId, subId, signatureDataUrl) {
  const customers = getCustomers();
  const c = customers.find(x => x.id === customerId);
  if (!c) return;
  const s = (c.subscriptions || []).find(x => x.id === subId);
  if (!s) return;
  s.active = true;
  s.acceptedAt = new Date().toISOString();
  s.signature = signatureDataUrl || null;
  saveCustomers(customers);
  // History
  addHistory(customerId, 'milestone', `Abo akzeptiert: ${s.title} (${eur(s.amount)}/Monat)`);
}

// ======= History / Timeline =====================================
// Eintrag hinzufügen (type: 'system' | 'milestone' | 'note' ...)
function addHistory(customerId, type, message) {
  const customers = getCustomers();
  const c = customers.find(x => x.id === customerId);
  if (!c) return;

  c.history = Array.isArray(c.history) ? c.history : [];
  const entry = {
    id: "H" + Date.now(),
    ts: new Date().toISOString(),
    type: type || "system",
    message: String(message || "")
  };
  c.history.push(entry);

  // optional: Deckel drauf (z. B. letzte 300 Einträge behalten)
  if (c.history.length > 300) c.history = c.history.slice(-300);

  saveCustomers(customers);
  return entry;
}

// nur zum Auslesen falls gebraucht
function getHistory(customerId) {
  const c = getCustomers().find(x => x.id === customerId);
  return c?.history || [];
}

// ---------- Customer schema / normalisieren ----------
const CUSTOMER_EXTRA_FIELDS = [
  "street","zip","city","country","phone",
  "instagram","facebook","linkedin","website","notes"
];

function normalizeCustomer(c) {
  const out = { ...c };
  CUSTOMER_EXTRA_FIELDS.forEach(k => { if (typeof out[k] === "undefined") out[k] = ""; });
  out.projects = Array.isArray(out.projects) ? out.projects : [];
  out.offers = Array.isArray(out.offers) ? out.offers : [];
  out.invoices = Array.isArray(out.invoices) ? out.invoices : [];
  out.subscriptions = Array.isArray(out.subscriptions) ? out.subscriptions : [];
  out.history = Array.isArray(out.history) ? out.history : [];
  return out;
}

function normalizeAllCustomers() {
  const list = getCustomers();
  const fixed = list.map(normalizeCustomer);
  saveCustomers(fixed);
  return fixed;
}

// Beim Laden einmal sicherstellen:
try { normalizeAllCustomers(); } catch(e){ /* noop */ }

// ---------- Update & CSV ----------
function updateCustomerById(id, patch) {
  const list = getCustomers();
  const idx = list.findIndex(c => c.id === id);
  if (idx === -1) return null;

  const before = { ...list[idx] };             // <-- vor dem Merge kopieren!
  const merged = { ...list[idx], ...patch };
  list[idx] = normalizeCustomer(merged);

  const changed = ['firstName', 'lastName', 'email', 'phone', 'paket']
    .filter(k => before[k] !== merged[k]);
  if (changed.length) {
    addHistory(id, 'note', `Daten aktualisiert: ${changed.join(', ')}`);
  }

  saveCustomers(list);
  return list[idx];
}

function exportCustomersCSV() {
  const rows = [];
  const header = [
    "id","dateAdded","firstName","lastName","email","paket",
    "street","zip","city","country","phone",
    "instagram","facebook","linkedin","website","notes"
  ];
  rows.push(header.join(";"));

  getCustomers().forEach(c => {
    const r = [
      c.id||"", c.dateAdded||"", c.firstName||"", c.lastName||"", c.email||"", c.paket||"",
      c.street||"", c.zip||"", c.city||"", c.country||"", c.phone||"",
      c.instagram||"", c.facebook||"", c.linkedin||"", c.website||"",
      (c.notes||"").replace(/\r?\n/g," ")
    ];
    rows.push(r.map(x=>String(x).replace(/;/g,",")).join(";"));
  });

  const blob = new Blob([rows.join("\n")], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `kunden_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// ---------- Sanity-Normalizer (Fix für Alt-Daten) ----------
function normalizeAll() {
  const list = getCustomers();
  let changed = false;

  const fixed = list.map(c => {
    const n = normalizeCustomer(c);
    if (JSON.stringify(n) !== JSON.stringify(c)) changed = true;
    return n;
  });

  if (changed) {
    saveCustomers(fixed); // WICHTIG: in customerDataList speichern
    console.log("normalizeAll(): Korrigiert und gespeichert.");
  } else {
    console.log("normalizeAll(): Alles schon ok.");
  }
}
normalizeAll();
