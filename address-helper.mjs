// Shared by both stores. No requests until explicitly enabled by the host.
export const disabledConfig = Object.freeze({enabled:false, endpoint:'', countries:[]});
const clean = value => String(value ?? '').trim();
const fold = value => clean(value).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
export function coherence(address, candidate) {
  const conflicts = ['country','postal','city','region'].filter(key =>
    clean(address[key]) && clean(candidate[key]) && fold(address[key]) !== fold(candidate[key]));
  return {verified: conflicts.length === 0, conflicts, blocking:false};
}
export function normalize(result) {
  return {country:clean(result.country_code).toUpperCase(), countryName:clean(result.country),
    region:clean(result.state || result.county), city:clean(result.city || result.town || result.village),
    postal:clean(result.postcode), street:clean(result.street), number:clean(result.housenumber),
    label:clean(result.formatted)};
}
export function createLookup(config=disabledConfig, transport=fetch) {
  let controller;
  return async (text,type='street',country='') => {
    controller?.abort();
    if (!config.enabled || !config.endpoint || clean(text).length<3) return {items:[],state:'manual'};
    if (!config.countries.includes(country)) return {items:[],state:'manual'};
    controller=new AbortController();
    try {
      const url=new URL(config.endpoint,globalThis.location?.href || 'http://localhost');
      url.search=new URLSearchParams({text:clean(text),type,country});
      const response=await transport(url,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(5000)]),credentials:'omit'});
      if(!response.ok) throw Error('unavailable');
      const data=await response.json();
      return {items:Array.isArray(data.items)?data.items.slice(0,6):[],state:'ready'};
    } catch(error) {return {items:[],state:error.name==='AbortError'?'cancelled':'unavailable'};}
  };
}
export function attachAddress(form,fields,config=disabledConfig) {
  if(!config.enabled) return; // Manual inputs remain untouched while archived.
  const lookup=createLookup(config);
  const status=document.createElement('p'); status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const list=document.createElement('div');list.setAttribute('aria-label','Sugerencias de dirección');
  const street=form.elements.namedItem(fields.street); if(!street)return;
  street.after(list,status);
  let timer,sequence=0;
  for(const key of ['country','region','city','postal','street','number']){
    const input=form.elements.namedItem(fields[key]);if(!input)continue;
    input.addEventListener('input',()=>{
      clearTimeout(timer);const current=++sequence;list.replaceChildren();
      timer=setTimeout(async()=>{
        const country=clean(form.elements.namedItem(fields.country)?.value || config.defaultCountry);
        const result=await lookup(input.value,{region:'state',city:'city',postal:'postcode',number:'housenumber',country:'country'}[key]||'street',country);
        if(current!==sequence)return;
        status.textContent=result.state==='unavailable'?'No podemos consultar sugerencias. Puedes escribir tu dirección y continuar.':'';
        for(const item of result.items){
          const button=document.createElement('button');button.type='button';button.textContent=item.label;
          button.style.cssText='display:block;width:100%;min-height:44px;text-align:left;margin:6px 0;white-space:normal';
          button.addEventListener('click',()=>{
            const before=Object.fromEntries(['country','region','city','postal'].map(k=>[k,form.elements.namedItem(fields[k])?.value||'']));
            const check=coherence(before,item);
            for(const k of ['country','region','city','postal','street','number']){
              const field=form.elements.namedItem(fields[k]);if(!field||!item[k])continue;
              field.value=k==='street'&&!fields.number?[item.street,item.number].filter(Boolean).join(' '):item[k];
              field.dispatchEvent(new Event('change',{bubbles:true}));
            }
            list.replaceChildren();status.textContent=check.verified?'Dirección sugerida. Revisa los datos antes de continuar.':'La sugerencia difiere de algunos datos introducidos. Revisa la dirección; puedes corregirla manualmente.';
          });list.append(button);
        }
        if(result.state==='ready'&&!result.items.length)status.textContent='No encontramos coincidencias. Puedes escribir tu dirección y continuar.';
      },350);
    });
  }
  // No setCustomValidity, disabled submit or submit interception: lookup never blocks checkout.
}
