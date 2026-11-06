'use strict';
const catalog = [
  { id:'silicona', name:'Chapa de silicona', price:890, color:'#e9bd80', body:'Chapa blanda de perfil redondo para sujetar con anilla.', shape:'<circle cx="140" cy="118" r="60" fill="#c97958"/><circle cx="140" cy="70" r="7" fill="#fff1d7"/>' },
  { id:'rigida', name:'Chapa rígida', price:690, color:'#dce9d9', body:'Identificación compacta de plástico rígido para el collar.', shape:'<rect x="92" y="61" width="96" height="117" rx="25" fill="#658a79"/><circle cx="140" cy="76" r="7" fill="#e7f0dc"/>' },
  { id:'pasador', name:'Pasador para arnés', price:990, color:'#f3e3b8', body:'Formato que se desliza por una correa. Ancho compatible pendiente de confirmar con la muestra.', shape:'<path d="M42 106h196v35H42z" fill="#977758"/><rect x="83" y="84" width="114" height="79" rx="18" fill="#c49545"/>' },
  { id:'clip', name:'Chapa con clip', price:1090, color:'#e4dcee', body:'Accesorio desmontable para collar o arnés. Sujeción pendiente de probar.', shape:'<path d="M127 77V53a13 13 0 0 1 26 0v28" fill="none" stroke="#805f86" stroke-width="10"/><rect x="94" y="81" width="92" height="90" rx="21" fill="#95749c"/>' }
];
const $ = id => document.getElementById(id);
const euro = n => new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(n/100);
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function load(key,fallback) { try { return JSON.parse(localStorage.getItem('mascotas:'+key)) ?? fallback; } catch { return fallback; } }
function save(key,value) { localStorage.setItem('mascotas:'+key,JSON.stringify(value)); }
let cart=load('cart',{}), orders=load('orders',[]), profiles=load('profiles',[]);
const native=window.MascotasNfc;
if(native) document.documentElement.classList.add('native');
const art = p => {
  const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 215"><rect width="280" height="215" fill="'+p.color+'"/><ellipse cx="140" cy="178" rx="72" ry="9" opacity=".12"/>'+p.shape+'<path d="M132 112q12 11 0 22m9-28q18 17 0 34m10-41q24 24 0 48" fill="none" stroke="#fff8e8" stroke-width="3" stroke-linecap="round"/></svg>';
  return '<img alt="Ilustración de '+p.name.toLowerCase()+'" src="data:image/svg+xml,'+encodeURIComponent(svg)+'">';
};
const rows = () => catalog.filter(p=>cart[p.id]>0);
const subtotal = () => rows().reduce((total,p)=>total+cart[p.id]*p.price,0);
function setQty(id,amount) {
  if(!catalog.some(p=>p.id===id)||!Number.isInteger(amount)) return;
  if(amount<=0) delete cart[id]; else cart[id]=Math.min(amount,20);
  save('cart',cart); renderCart();
}
function renderCart() {
  $('count').textContent=rows().reduce((total,p)=>total+cart[p.id],0);
  $('cart').innerHTML=rows().length ? '<div class="panel">'+rows().map(p=>'<div class="line"><strong>'+p.name+'</strong><span>'+euro(p.price*cart[p.id])+'</span><div><button class="secondary" data-qty="'+p.id+'" data-delta="-1" aria-label="Quitar una unidad">−</button> '+cart[p.id]+' <button class="secondary" data-qty="'+p.id+'" data-delta="1" aria-label="Añadir una unidad">+</button> <button class="secondary" data-remove="'+p.id+'">Eliminar</button></div></div>').join('')+'<p class="price">Subtotal '+euro(subtotal())+'</p><a class="button" href="#pedido">Continuar al pedido</a></div>' : '<p>Tu cesta está vacía.</p><a class="button" href="#tienda">Explorar la tienda</a>';
  const shipping=$('checkout').elements.shipping.value==='canarias'?200:400;
  $('summary').textContent=rows().length?'Productos '+euro(subtotal())+' · Envío '+euro(shipping)+' · Total '+euro(subtotal()+shipping):'La cesta está vacía.';
  $('checkout').hidden=!rows().length;
}
$('products').innerHTML=catalog.map(p=>'<article class="card"><a href="#producto/'+p.id+'">'+art(p)+'<h2>'+p.name+'</h2></a><p>'+p.body+'</p><p class="price">'+euro(p.price)+'</p><button data-add="'+p.id+'">Añadir a la cesta</button></article>').join('');
function route() {
  const [page,id]=location.hash.slice(1).split('/');
  const product=catalog.find(p=>p.id===id);
  const target=page==='producto'&&!product?'tienda':(document.getElementById(page)?.classList.contains('page')?page:'inicio');
  document.querySelectorAll('.page').forEach(el=>el.hidden=el.id!==target);
  document.querySelectorAll('nav a').forEach(a=>{if(a.hash==='#'+target) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current');});
  if(target==='producto') $('product').innerHTML='<div class="product-detail">'+art(product)+'<div><p class="eyebrow">CONCEPTO DE CATÁLOGO</p><h1>'+product.name+'</h1><p>'+product.body+'</p><p class="price">'+euro(product.price)+'</p><button data-add="'+product.id+'">Añadir a la cesta</button></div></div>';
  if(target==='pedidos') $('orders').innerHTML=orders.length?orders.map(o=>'<article class="panel"><h2>'+escape(o.id)+'</h2><p>'+escape(o.alias)+' · '+euro(o.total)+'</p><p>'+escape(o.items.join(', '))+'</p></article>').join(''):'<p>Aún no hay pedidos guardados aquí.</p>';
  window.scrollTo(0,0);
}
$('checkout').elements.shipping.addEventListener('change',renderCart);
$('checkout').addEventListener('submit',event=>{
  event.preventDefault(); if(!rows().length)return;
  const form=new FormData(event.currentTarget), alias=String(form.get('alias')).trim(); if(!alias)return;
  const id='M-'+Date.now().toString(36).toUpperCase();
  orders=[{id,alias,items:rows().map(p=>cart[p.id]+' × '+p.name),total:subtotal()+(form.get('shipping')==='canarias'?200:400)},...orders].slice(0,50);
  save('orders',orders);cart={};save('cart',cart);event.currentTarget.reset();renderCart();
  $('receipt').innerHTML='Pedido de prueba '+id+' guardado. <a href="#pedidos">Ver pedidos</a>';
});
function renderProfiles() {
  $('profiles').innerHTML=profiles.map((p,i)=>'<article class="panel"><h2>'+escape(p.pet)+'</h2>'+(p.phone?'<p>Contacto '+escape(p.phone)+'</p>':'')+(p.notes?'<p>'+escape(p.notes)+'</p>':'')+'<div class="actions"><button data-write="'+i+'">Grabar '+(p.url?'enlace':'texto')+'</button><button class="secondary" data-edit="'+i+'">Editar</button><button class="secondary" data-delete="'+i+'">Quitar borrador</button></div></article>').join('');
}
let editIndex=null;
$('profile').addEventListener('submit',event=>{
  event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget));
  for(const key of Object.keys(data))data[key]=data[key].trim();
  if(!data.pet)return;
  if(data.url){try{const url=new URL(data.url);if(url.protocol!=='https:'||url.username||url.password)throw Error();data.url=url.href;}catch{$('nfc-status').textContent='Introduce un enlace HTTPS válido.';return;}}
  if(editIndex===null) profiles.push(data);else profiles[editIndex]=data;
  editIndex=null;save('profiles',profiles);event.currentTarget.reset();renderProfiles();$('nfc-status').textContent='Ficha guardada en este dispositivo.';
});
window.nfcResult=message=>{$('nfc-status').textContent=message;};
async function nfc(operation,kind='',value='') {
  if(native){native.prepare(operation,kind,value);return;}
  if(typeof NDEFReader==='undefined') {window.nfcResult('Usa la app de Android o un navegador Android compatible con NFC.');return;}
  try {
    const reader=new NDEFReader(), signal=AbortSignal.timeout(25000);
    window.nfcResult('Acerca la chapa al móvil.');
    if(operation==='read'){
      await reader.scan({signal});
      reader.onreading=event=>{window.nfcResult(Array.from(event.message.records,r=>r.data?new TextDecoder(r.encoding||'utf-8').decode(r.data):'Chapa vacía').join(' · '));};
      reader.onreadingerror=()=>window.nfcResult('No se pudo leer la chapa.');
      signal.addEventListener('abort',()=>{reader.onreading=null;},{once:true});
      return;
    }
    const record=operation==='erase'?{recordType:'empty'}:{recordType:kind,data:value};
    await reader.write({records:[record]},{signal});
    window.nfcResult(operation==='erase'?'Contenido borrado. Vuelve a leer la chapa para comprobarlo.':'Grabación terminada. Vuelve a leer la chapa para comprobarla.');
  }catch{window.nfcResult('No se pudo completar la operación NFC. Comprueba permisos, capacidad y compatibilidad.');}
}
$('read').onclick=()=>nfc('read');
$('erase').onclick=()=>{const dialog=$('confirm');dialog.returnValue='';dialog.showModal();};
$('confirm').onclose=()=>{if($('confirm').returnValue==='erase')nfc('erase');};
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  const d=button.dataset;
  if(d.add){setQty(d.add,(cart[d.add]||0)+1);location.hash='carrito';}
  if(d.qty)setQty(d.qty,(cart[d.qty]||0)+Number(d.delta));
  if(d.remove)setQty(d.remove,0);
  if(d.edit!==undefined){editIndex=Number(d.edit);Object.entries(profiles[editIndex]).forEach(([key,val])=>$('profile').elements[key].value=val);$('profile').elements.pet.focus();}
  if(d.delete!==undefined&&confirm('¿Quitar esta ficha guardada en el dispositivo?')){profiles.splice(Number(d.delete),1);editIndex=null;$('profile').reset();save('profiles',profiles);renderProfiles();}
  if(d.write!==undefined){const p=profiles[Number(d.write)];if(confirm('¿Grabar esta información en la chapa? Se sustituirá su contenido actual.'))nfc('write',p.url?'url':'text',p.url||[p.pet,p.phone&&'Contacto: '+p.phone,p.notes].filter(Boolean).join('\n'));}
});
window.addEventListener('hashchange',route);
renderCart();renderProfiles();route();
