window.addEventListener('DOMContentLoaded', () => {
  const $ = (s) => document.querySelector(s);

  // Elements
  const langSel = $('#lang');
  const darkToggle = $('#darkToggle');
  const tabLinks = document.querySelectorAll('#tabs .nav-link');

  const sections = {
    services: $('#servicesSection'),
    map: $('#mapSection'),
    urgent: $('#urgentSection'),
    asylum: $('#asylumSection'),
    legal: $('#legalSection'),
    info: $('#infoSection'),
    prevention: $('#preventionSection')
  };

  const searchInp = $('#search');
  const filtersEl = $('#filters');
  const servicesEl = $('#services');
  const noResultsEl = $('#noResults');

  // State
  let lang = localStorage.getItem('kobo_lang') || 'fr';
  let T = {};
  let DATA = { services: [] };
  let activeType = 'all';
  let selectedCard = null;

  /* ===== DARK / LIGHT ===== */
  applyDark(localStorage.getItem('kobo_dark') === '1');
  darkToggle?.addEventListener('click', () => applyDark(!document.documentElement.classList.contains('dark')));
  function applyDark(on){
    document.documentElement.classList.toggle('dark', on);
    if (darkToggle) darkToggle.textContent = on ? '☀' : '☾';
    localStorage.setItem('kobo_dark', on ? '1' : '0');
  }

  /* ===== LOAD ===== */
  Promise.all([fetchJSON('translations.json'), fetchJSON('data.json')])
    .then(([tr, data])=>{
      T = tr || {};
      DATA = data || { services: [] };
      initUI();
      renderFilters();
      renderServices();
      fillUrgencies();
      fillAsylum();
      fillLegal();
      fillInfo();
      fillPrevention();
      ensureDefaultHash();
      route();
      window.addEventListener('hashchange', route);

      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js').catch(()=>{});
      }
    })
    .catch(err=>console.error(err));

  function initUI(){
    if (langSel){
      langSel.value = lang;
      langSel.onchange = (e)=>{
        lang = e.target.value;
        localStorage.setItem('kobo_lang', lang);
        applyLang();
        renderFilters();
        renderServices();
        fillUrgencies();
        fillAsylum();
        fillLegal();
        fillInfo();
        fillPrevention();
        mapRefresh();
      };
    }
    applyLang();

    if (searchInp) searchInp.oninput = () => { renderServices(); mapRefresh(); };

    tabLinks.forEach(a=>{
      a.addEventListener('click', () => {
        const sec = a.getAttribute('data-section');
        if (sec) location.hash = `#/${sec}`;
      });
    });
  }

  function t(key, fallback=''){ return (T?.[lang]?.[key]) ?? fallback; }
  function setText(sel, text){ const el=document.querySelector(sel); if(el) el.textContent=text; }

  function applyLang(){
    document.body.classList.toggle('rtl', lang === 'ar');
    setText('[data-i="tab_services"]', t('tab_services','Services'));
    setText('[data-i="tab_map"]', t('tab_map','Carte'));
    setText('[data-i="tab_urgent"]', t('tab_urgent','Urgences'));
    setText('[data-i="tab_asylum"]', t('tab_asylum','Asile'));
    setText('[data-i="tab_legal"]', t('tab_legal','Juridique'));
    setText('[data-i="tab_info"]', t('tab_info','Infos'));
    setText('[data-i="tab_prevention"]', t('tab_prevention','Prévention'));
    setText('[data-i="map_title"]', t('map_title','Carte — Calais & Dunkerque'));
    setText('[data-i="urgent_title"]', t('urgent_title','Numéros d’urgence en France'));
    setText('[data-i="asylum_title"]', t('asylum_title','Procédure d’asile : étapes clés'));
    setText('[data-i="legal_title"]', t('legal_title','Informations juridiques'));
    setText('[data-i="info_title"]', t('info_title','Infos utiles'));
    setText('[data-i="prevention_title"]', t('prevention_title','Prévention des risques'));
    if (searchInp) searchInp.placeholder = t('search_placeholder','Search a service…');
    setText('[data-i="map_hint"]', t('map_hint','Tip: tap a pin to open directions (Google Maps).'));
  }

  /* ===== ROUTER ===== */
  function ensureDefaultHash(){
    if (!location.hash || !location.hash.startsWith('#/')){
      location.replace('#/services');
    }
  }

  function route(){
    const raw = (location.hash || '').toLowerCase();
    const page = raw.startsWith('#/') ? raw.slice(2) : 'services';

    Object.entries(sections).forEach(([key, el])=>{
      if (!el) return;
      el.classList.toggle('hidden', key !== page);
    });

    tabLinks.forEach(a=>{
      const sec = a.getAttribute('data-section');
      a.classList.toggle('active', sec === page);
    });

    if (page === 'map') mapInit();
  }

  /* ===== FILTERS + SERVICES LIST ===== */
  function renderFilters(){
    const TYPES = [
      { key:'all', label:t('all','Tous') },
      { key:'Health', label:t('cat_health','Santé') },
      { key:'Food', label:t('cat_food','Alimentation') },
      { key:'Shelter', label:t('cat_shelter','Hébergement') },
      { key:'Legal', label:t('cat_legal','Juridique') },
      { key:'Hygiene', label:t('cat_hygiene','Hygiène') },
      { key:'Mobile', label:t('cat_mobile','Associations mobiles') }
    ];
    if (!filtersEl) return;
    filtersEl.innerHTML = '';
    TYPES.forEach(tp=>{
      const b = document.createElement('button');
      b.className = 'filter-btn' + (activeType===tp.key ? ' active':'');
      b.textContent = tp.label;
      b.onclick = ()=>{ activeType = tp.key; renderServices(); mapRefresh(); };
      filtersEl.appendChild(b);
    });
  }

  function renderServices(){
    if (!servicesEl) return;

    const q = (searchInp?.value || '').toLowerCase();
    const list = (DATA.services || []).filter(s=>{
      const typeOk = (activeType === 'all' || s.type === activeType);
      const name = s['name_'+lang] || s.name_fr || s.name_en || '';
      const desc = s['desc_'+lang] || s.desc_fr || s.desc_en || '';
      const text = (name + ' ' + desc + ' ' + (s.address || '')).toLowerCase();
      return typeOk && text.includes(q);
    });

    servicesEl.innerHTML = '';
    selectedCard = null;
    if (!list.length){ noResultsEl?.classList.remove('hidden'); return; }
    noResultsEl?.classList.add('hidden');

    list.forEach((s)=>{
      const card = document.createElement('article');
      card.className = 'card selectable';
      card.setAttribute('tabindex','0');
      card.setAttribute('role','button');
      card.setAttribute('aria-pressed','false');

      card.innerHTML = `
        <div class="service">
          <div class="ic">${iconForType(s.type)}</div>
          <div class="flex-1">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
              <h3 style="margin:0">${s['name_'+lang] || s.name_fr || s.name_en || ''}</h3>
              <span class="badge">${labelForType(s.type)}</span>
            </div>
            <p style="margin:.25rem 0 .25rem 0;opacity:.9">${s['desc_'+lang] || s.desc_fr || s.desc_en || ''}</p>
            ${s.address ? `<div class="muted" style="font-size:12px">${s.address}</div>` : ''}
            ${s.maps ? `<div style="margin-top:6px"><a class="link" href="${s.maps}" target="_blank">${t('map_link','Voir sur la carte')}</a></div>` : ''}
          </div>
        </div>`;

      const selectThis = () => {
        if (selectedCard) {
          selectedCard.classList.remove('selected');
          selectedCard.setAttribute('aria-pressed','false');
        }
        card.classList.add('selected');
        card.setAttribute('aria-pressed','true');
        selectedCard = card;
      };
      card.addEventListener('click', selectThis);
      card.addEventListener('keydown', (e)=>{
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectThis(); }
      });

      servicesEl.appendChild(card);
    });
  }

  function iconForType(type){
    return { Health:'❤', Food:'🍽️', Shelter:'🏠', Legal:'⚖️', Hygiene:'🚿', Mobile:'🚌' }[type] || '📍';
  }
  function labelForType(type){
    return {
      Health:t('cat_health','Santé'),
      Food:t('cat_food','Alimentation'),
      Shelter:t('cat_shelter','Hébergement'),
      Legal:t('cat_legal','Juridique'),
      Hygiene:t('cat_hygiene','Hygiène'),
      Mobile:t('cat_mobile','Associations mobiles')
    }[type] || t('cat_service','Service');
  }

  /* ===== STATIC PAGES ===== */
  function fillUrgencies(){
    const list = document.querySelector('#urgentList');
    if (!list) return;
    list.innerHTML = '';
    const nums = [
      {label:t('num_112','112 (Urgences européennes)'), tel:'+33112'},
      {label:t('num_15','15 (SAMU)'), tel:'+33115'},
      {label:t('num_17','17 (Police)'), tel:'+33117'},
      {label:t('num_18','18 (Pompiers)'), tel:'+33118'},
      {label:t('num_115','115 (Hébergement d’urgence)'), tel:'+33115'},
      {label:t('num_3919','3919 (Violences faites aux femmes)'), tel:'+333919'},
      {label:t('num_119','119 (Enfance en danger)'), tel:'+33119'},
      {label:t('num_114','114 (SMS/visio – sourds/malentendants)'), tel:'+33114'}
    ];
    nums.forEach(n=>{
      const li = document.createElement('li');
      li.innerHTML = `<a class="link" href="tel:${n.tel}">${n.label}</a>`;
      list.appendChild(li);
    });
  }

  function fillAsylum(){
    ulFill('#asylumContent', [
      t('asylum_step1','Se présenter à la préfecture (GUDA) pour l’enregistrement.'),
      t('asylum_step2','Orientation vers un lieu d’hébergement / domiciliation.'),
      t('asylum_step3','Dépôt du récit et entretien à l’OFPRA.'),
      t('asylum_step4','Décision OFPRA ; recours possible devant la CNDA.'),
      t('asylum_step5','Associations locales : information et accompagnement.')
    ]);
  }

  function fillLegal(){
    ulFill('#legalContent', [
      t('legal_point1','Droit à la non-refoulement et examen individuel.'),
      t('legal_point2','Aide juridique via associations (Cimade, FTDA, etc.).'),
      t('legal_point3','Accès hébergement et soins pendant la procédure (selon statut).')
    ]);
  }

  function fillInfo(){
    ulFill('#infoList', [
      t('info_ukfr','Accord UK–France : voies sûres & informations utiles.'),
      t('info_trafficking','Prévenir la traite : repères et contacts.'),
      t('info_dublin','Procédure Dublin : empreintes, transferts, vos droits.')
    ]);
  }

  function fillPrevention(){
    ulFill('#preventionList', [
      t('prev_1','Ne montez pas dans des véhicules inconnus ou non identifiés.'),
      t('prev_2','Méfiez-vous des offres de passage payant ou dangereux.'),
      t('prev_3','Gardez vos documents importants en sécurité.'),
      t('prev_4','En cas de danger, contactez les services d’urgence.'),
      t('prev_5','Renseignez-vous auprès des associations fiables.')
    ]);
  }

  function ulFill(sel, arr){
    const el = document.querySelector(sel);
    if (!el) return;
    el.innerHTML = '';
    arr.forEach(txt=>{
      const li=document.createElement('li');
      li.textContent = txt;
      el.appendChild(li);
    });
  }

  /* ===== MAP (Leaflet) ===== */
  let map, markers = [];
  function mapInit(){
    if (map) { map.invalidateSize(); mapRefresh(); return; }
    const el = document.getElementById('leafletMap');
    if (!el) return;

    map = L.map(el, { zoomControl: true, attributionControl: false })
      .setView([50.98, 2.12], 10);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    mapRefresh();
  }

  const UNHCR_BLUE = '#0072CE';
  const pinSvg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="56" viewBox="0 0 40 56">
      <defs>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.2" flood-color="rgba(0,0,0,0.35)"/>
        </filter>
      </defs>
      <path filter="url(#shadow)" fill="${UNHCR_BLUE}" d="M20 0C9 0 0 9 0 20c0 15 20 36 20 36s20-21 20-36C40 9 31 0 20 0z"/>
      <circle cx="20" cy="20" r="7" fill="#ffffff"/>
    </svg>
  `);
  const pinIcon = L.icon({
    iconUrl: `data:image/svg+xml;charset=UTF-8,${pinSvg}`,
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -36]
  });

  function mapRefresh(){
    if (!map) return;
    markers.forEach(m=>m.remove());
    markers = [];

    const q = (searchInp?.value || '').toLowerCase();
    const list = (DATA.services || []).filter(s=>{
      const typeOk = (activeType === 'all' || s.type === activeType);
      const name = s['name_'+lang] || s.name_fr || s.name_en || '';
      const desc = s['desc_'+lang] || s.desc_fr || s.desc_en || '';
      const text = (name + ' ' + desc + ' ' + (s.address || '')).toLowerCase();
      return typeOk && text.includes(q) && typeof s.lat==='number' && typeof s.lng==='number';
    });

    const group = [];
    list.forEach(s=>{
      const m = L.marker([s.lat, s.lng], { icon: pinIcon }).addTo(map);
      m.bindPopup(`
        <div style="min-width:200px">
          <strong>${s['name_'+lang] || s.name_fr || s.name_en || ''}</strong><br/>
          ${s.address ? `<span class="muted">${s.address}</span><br/>` : ''}
          ${s['desc_'+lang] || s.desc_fr || s.desc_en || ''}<br/>
          ${s.maps ? `<a class="link" target="_blank" href="${s.maps}">${t('map_link','Voir sur la carte')}</a>` : ''}
        </div>
      `);
      markers.push(m);
      group.push([s.lat, s.lng]);
    });

    if (group.length){
      const bounds = L.latLngBounds(group);
      map.fitBounds(bounds, { padding:[20,20] });
      if (map.getZoom() > 14) map.setZoom(14);
    }
  }

  async function fetchJSON(path){
    const r = await fetch(path, { cache:'no-cache' });
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${path}`);
    return r.json();
  }
});