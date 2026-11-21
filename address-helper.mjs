export const disabledConfig=Object.freeze({enabled:false,endpoint:'',countries:[]});
const clean=v=>String(v??'').trim();
const fold=v=>clean(v).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
export function coherence(a,b){const conflicts=['country','postal','city','region'].filter(k=>clean(a[k])&&clean(b[k])&&fold(a[k])!==fold(b[k]));return {verified:conflicts.length===0,conflicts,blocking:false};}
export function normalize(r){return {country:clean(r.country_code).toUpperCase(),countryName:clean(r.country),region:clean(r.country_code).toLowerCase()==='es'?clean(r.county||r.state):clean(r.state||r.county),city:clean(r.city||r.town||r.village||r.municipality),postal:clean(r.postcode),street:clean(r.street),number:clean(r.housenumber),label:clean(r.formatted)};}
export function createLookup(config=disabledConfig,transport=fetch){
 let controller;
 return async(text,type='street',country='',context={})=>{
  controller?.abort();if(!config.enabled||!config.endpoint||clean(text).length<3||!config.countries.includes(country))return {items:[],state:'manual'};
  controller=new AbortController();const own=controller;
  const timer=setTimeout(()=>own.abort(),5000);
  try{const r=await transport(config.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:clean(text),type,country,city:clean(context.city),region:clean(context.region),postal:clean(context.postal)}),signal:own.signal,credentials:'omit'});if(!r.ok)throw Error();const data=await r.json();return {items:Array.isArray(data.items)?data.items.slice(0,6):[],state:data.state||'ready'};}catch{return {items:[],state:own.signal.aborted?'cancelled':'unavailable'};}finally{clearTimeout(timer);}
 };
}
export function attachAddress(form,fields,config=disabledConfig){
 const street=form.elements.namedItem(fields.street);if(!street||!config.enabled)return;
 const lookup=createLookup(config),status=document.createElement('p'),manual=document.createElement('button'),list=document.createElement('div'),info=document.createElement('details');
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');list.setAttribute('role','group');list.setAttribute('aria-label','Sugerencias de dirección');
 manual.type='button';manual.className='address-manual secondary';manual.textContent='Introducir la dirección manualmente';
 info.className='address-info';const summary=document.createElement('summary');summary.textContent='Sobre las sugerencias de direcciones';const note=document.createElement('p');note.textContent='Solo los datos postales de la búsqueda se consultan en Geoapify. No enviamos tu nombre, teléfono, correo ni información NFC. Puedes usar la entrada manual.';info.append(summary,note);
 const attr=document.createElement('p');attr.className='address-attribution';for(const [name,url]of [['Geoapify','https://www.geoapify.com/'],['OpenStreetMap','https://www.openstreetmap.org/copyright']]){const a=document.createElement('a');a.textContent=name;a.href=url;a.target='_blank';a.rel='noopener noreferrer';attr.append(a,document.createTextNode(' '));}info.append(attr);
 const group=street.closest('[data-billing-address]')||street.closest('fieldset')||street.parentElement;const legend=group.querySelector(':scope > legend');if(legend)legend.after(info,manual);else group.prepend(info,manual);group.append(status);
 let timer,sequence=0,manualMode=false;
 function read(k){return clean(form.elements.namedItem(fields[k])?.value);}
 function country(){const raw=read('country');return config.countries.find(c=>c===raw||fold(new Intl.DisplayNames(['es'],{type:'region'}).of(c))===fold(raw))||'';}
 function hide(){++sequence;clearTimeout(timer);list.replaceChildren();}
 manual.addEventListener('click',()=>{manualMode=!manualMode;hide();manual.textContent=manualMode?'Activar sugerencias de direcciones':'Introducir la dirección manualmente';status.textContent=manualMode?'Puedes escribir o corregir todos los datos manualmente.':'';});
 list.addEventListener('keydown',e=>{const buttons=[...list.querySelectorAll('button')],i=buttons.indexOf(document.activeElement);if(e.key==='Escape'){hide();return;}if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();buttons[(i+(e.key==='ArrowDown'?1:buttons.length-1))%buttons.length]?.focus();}});
 for(const key of ['region','city','postal','street']){
  const input=form.elements.namedItem(fields[key]);if(!input)continue;
  input.addEventListener('input',()=>{
   hide();if(manualMode||input.disabled)return;const current=sequence;
   timer=setTimeout(async()=>{
    const context={city:read('city'),region:read('region'),postal:read('postal')};
    if(key==='city')context.city='';if(key==='region'){context.region='';context.city='';context.postal='';}if(key==='postal'){context.postal='';context.city='';}
    const result=await lookup(input.value,{region:'state',city:'city',postal:'postcode',street:/\d/.test(input.value)?'housenumber':'street'}[key],country(),context);
    if(current!==sequence)return;
    (input.closest('label')||input).after(list);list.replaceChildren();status.textContent=result.state==='unavailable'||result.state==='cancelled'?'No podemos consultar sugerencias. Puedes escribir tu dirección y continuar.':'';
    for(const item of result.items){
     const button=document.createElement('button');button.type='button';button.className='address-suggestion';button.textContent=item.label;
     button.addEventListener('click',()=>{
      const check=coherence({country:country(),city:read('city'),region:read('region'),postal:read('postal')},item);
      const keys=key==='region'?['region']:key==='city'?['city','region','postal']:key==='postal'?['postal','city','region']:['city','region','postal','street'];
      for(const k of keys){const target=form.elements.namedItem(fields[k]);if(!target||!item[k])continue;target.value=k==='street'?[item.street,item.number].filter(Boolean).join(' '):item[k];target.dispatchEvent(new Event('change',{bubbles:true}));}
      hide();status.textContent=check.verified?'Sugerencia seleccionada. Revisa la dirección y el número.':'La sugerencia cambia algunos datos. Revisa la dirección; puedes corregirla manualmente.';input.focus();
     });list.append(button);
    }
    if(result.state==='ready'&&!result.items.length)status.textContent='No encontramos coincidencias. Puedes escribir tu dirección y continuar.';
   },450);
  });
  input.addEventListener('keydown',e=>{if(e.key==='ArrowDown'&&list.childElementCount){e.preventDefault();list.querySelector('button')?.focus();}else if(e.key==='Escape')hide();});
 }
 // A soft server check after completing postcode/locality/region; never intercept submit.
 let verification=0;
 group.addEventListener('focusout',()=>{
  const version=++verification;if(manualMode||!read('postal')||!read('city')||!read('region')||!config.verifyEndpoint)return;
  clearTimeout(timer);timer=setTimeout(async()=>{
   try{const r=await fetch(config.verifyEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:read('postal'),type:'postcode',country:country(),postal:read('postal'),city:read('city'),region:read('region')}),credentials:'omit',signal:AbortSignal.timeout(4500)});const data=await r.json();if(version===verification&&data.message)status.textContent=data.message;}catch{/* Manual entry and checkout stay available. */}
  },800);
 });
}

// Configuration may wake a sleeping free server. Never freeze the manual form.
export async function loadAddressConfiguration(url,transport=fetch,timeoutMs=65000){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{const response=await transport(url,{credentials:'omit',cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('unavailable');const data=await response.json();if(typeof data.enabled!=='boolean'||!Array.isArray(data.countries))throw Error('invalid-config');return data;}finally{clearTimeout(timer);}
}
