import {attachAddress} from './address-helper.mjs';
const script=document.querySelector('script[src*="address-init.mjs"]');
const api=script?.dataset.addressApi||location.origin;
async function initialize(){
 const forms=[...document.forms].filter(f=>f.elements.namedItem('street')&&f.elements.namedItem('postal'));
 if(!forms.length)return;
 try{
 const r=await fetch(new URL('/api/address/config',api),{credentials:'omit',signal:AbortSignal.timeout(4000)});if(!r.ok)return;const config=await r.json();if(!config.enabled)return;
 config.endpoint=new URL(config.endpoint,api).href;config.verifyEndpoint=new URL(config.verifyEndpoint,api).href;
 const names=new Intl.DisplayNames(['es'],{type:'region'});
 for(const form of forms){
  for(const prefix of ['', 'billing']){
   const name=k=>prefix?prefix+k[0].toUpperCase()+k.slice(1):k;
   const street=form.elements.namedItem(name('street'));if(!street)continue;
   let country=form.elements.namedItem(prefix?'billingCountry':'addressCountry');
   if(!country){const label=document.createElement('label');label.textContent='País';country=document.createElement('select');country.name='addressCountry';label.append(country);street.closest('label').before(label);}
   if(prefix&&country.tagName==='INPUT'){
    const options=document.createElement('datalist');options.id='address-countries-'+prefix;
    for(const code of config.countries){const option=document.createElement('option');option.value=names.of(code);options.append(option);}
    country.after(options);country.setAttribute('list',options.id);if(!country.value&&config.countries.includes('ES'))country.value=names.of('ES');
   }
   if(country.tagName==='SELECT'&&!country.options.length){for(const code of config.countries){const option=document.createElement('option');option.value=prefix?names.of(code):code;option.textContent=names.of(code);country.append(option);}}
   const fields=Object.fromEntries(['street','postal','city','region'].map(k=>[k,name(k)]));fields.country=country.name;attachAddress(form,fields,config);
  }
 }
 }catch{/* A provider/config outage must never break the original manual form. */}
}
initialize();
