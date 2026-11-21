import {attachAddress,loadAddressConfiguration} from './address-helper.mjs';
const script=document.querySelector('script[src*="address-init.mjs"]');
const api=script?.dataset.addressApi||location.origin;
let inFlight=false,finished=false,retryTimer;
async function initialize(){
 if(inFlight||finished)return;
 inFlight=true;
 const forms=[...document.forms].filter(f=>f.elements.namedItem('street')&&f.elements.namedItem('postal'));
 if(!forms.length){inFlight=false;return;}
 const notices=forms.map(form=>{let panel=form.querySelector('[data-address-availability]');if(!panel){panel=document.createElement('div');panel.dataset.addressAvailability='';const status=document.createElement('p');status.setAttribute('role','status');status.textContent='Preparando sugerencias de direcciones. Puedes rellenar los campos manualmente mientras tanto.';const retry=document.createElement('button');retry.type='button';retry.className='secondary';retry.textContent='Reintentar sugerencias de direcciones';retry.hidden=true;retry.addEventListener('click',()=>{finished=false;initialize();});panel.append(status,retry);form.prepend(panel);}panel.querySelector('button').hidden=true;return panel;});
 try{
 const config=await loadAddressConfiguration(new URL('/api/address/config',api));if(!config.enabled){notices.forEach(panel=>panel.remove());finished=true;return;}
 config.endpoint=new URL(config.endpoint,api).href;config.verifyEndpoint=new URL(config.verifyEndpoint,api).href;
 const names=new Intl.DisplayNames(['es'],{type:'region'});
 for(const form of forms){
  if(form.dataset.addressReady==='1')continue;
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
  form.dataset.addressReady='1';
 }
 finished=true;notices.forEach(panel=>panel.remove());
 const active=document.activeElement;if(active&&forms.some(form=>form.contains(active))&&['postal','billingPostal','city','billingCity','street','billingStreet','region','billingRegion'].includes(active.name)&&active.value.length>=3)active.dispatchEvent(new Event('input',{bubbles:true}));
 }catch{for(const panel of notices){panel.querySelector('p').textContent='No se han podido cargar las sugerencias. Puedes continuar escribiendo tu dirección o reintentarlo.';panel.querySelector('button').hidden=false;}clearTimeout(retryTimer);retryTimer=setTimeout(initialize,10000);}
 finally{inFlight=false;}
}
window.addEventListener('online',()=>{if(!finished)initialize();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!finished)initialize();});
document.addEventListener('focusin',event=>{if(!finished&&event.target.closest('form'))initialize();});
initialize();
