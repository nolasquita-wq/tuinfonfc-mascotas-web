'use strict';
let catalog = [
  { id:'silicona', name:'Chapa de silicona', price:890, body:'Chapa blanda de perfil redondo para sujetar con anilla.' },
  { id:'rigida', name:'Chapa rígida', price:690, body:'Identificación compacta de plástico rígido para el collar.' },
  { id:'pasador', name:'Pasador para arnés', price:990, body:'Formato que se desliza por una correa.' },
  { id:'clip', name:'Chapa con clip', price:1090, body:'Accesorio desmontable para collar o arnés.' }
];
const $ = id => document.getElementById(id);
const euro = n => new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(n/100);
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function load(key,fallback) { try { return JSON.parse(localStorage.getItem('mascotas:'+key)) ?? fallback; } catch { return fallback; } }
function save(key,value) { localStorage.setItem('mascotas:'+key,JSON.stringify(value)); }
let cart=load('cart',{}), orders=load('orders',[]), profiles=load('profiles',[]);
const native=window.MascotasNfc;
if(native) document.documentElement.classList.add('native');
const salesBase='https://tuinfonfc-prototipo.onrender.com';
async function sales(path,payload){
  const response=await fetch(salesBase+'/api/mascotas/'+path,payload===undefined?{signal:AbortSignal.timeout(12000)}:{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(12000)
  });
  if(!response.headers.get('content-type')?.includes('application/json'))throw Error('No se pudo conectar con la tienda. Vuelve a intentarlo.');
  const result=await response.json();
  if(!response.ok)throw Error(result.error);
  return result;
}
const art = p => '<img alt="Imagen orientativa de '+escape(p.name.toLowerCase())+'" src="'+(p.imageUrl&&/^\/media\/[a-f0-9]{64}\.(png|jpg|webp)$/.test(p.imageUrl)?salesBase+p.imageUrl: ['silicona','rigida','pasador','clip'].includes(p.id)?p.id+'.webp':'marca.svg')+'" width="720" height="720">';
const rows = () => catalog.filter(p=>cart[p.id]>0);
const subtotal = () => rows().reduce((total,p)=>total+cart[p.id]*p.price,0);
function setQty(id,amount) {
  if(checkoutBusy||!catalog.some(p=>p.id===id)||!Number.isInteger(amount)) return;
  const existing=cart[id]>0;
  if(amount<=0) delete cart[id]; else cart[id]=Math.min(amount,20);
  save('cart',cart);
  if(existing&&amount>0){
    const input=$('cart').querySelector('[data-count="'+id+'"]');
    const line=input.closest('.cart-line');
    input.value=cart[id];
    line.querySelector('[data-delta="-1"]').disabled=cart[id]===1;
    line.querySelector('[data-delta="1"]').disabled=cart[id]===20;
    line.querySelector('[data-line-total]').textContent=euro(catalog.find(p=>p.id===id).price*cart[id]);
    $('cart').querySelector('[data-subtotal]').textContent='Subtotal '+euro(subtotal());
    renderSummary();
  }else renderCart();
}
function renderCart() {
  $('cart').innerHTML=rows().length
    ? '<div class="panel">'+rows().map(p=>`<div class="line cart-line">
      <a class="cart-product" href="#producto/${p.id}">${art(p)}<span><strong>${escape(p.name)}</strong><br>${euro(p.price)} por unidad</span></a>
      <div class="quantity">
        <button class="secondary" data-qty="${p.id}" data-delta="-1" aria-label="Quitar una unidad" ${cart[p.id]===1?'disabled':''}>−</button>
        <input type="number" min="1" max="20" step="1" data-count="${p.id}" value="${cart[p.id]}" aria-label="Cantidad de ${escape(p.name)}">
        <button class="secondary" data-qty="${p.id}" data-delta="1" aria-label="Añadir una unidad" ${cart[p.id]===20?'disabled':''}>+</button>
      </div>
      <button class="secondary remove-item" data-remove="${p.id}" aria-label="Quitar ${escape(p.name)} de la cesta">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7m4-7v7"/></svg>
      </button><strong data-line-total>${euro(p.price*cart[p.id])}</strong>
      </div>`).join('')+'<p class="price" data-subtotal>Subtotal '+euro(subtotal())+'</p><div class="actions"><a class="button" href="#pedido">Continuar al pedido</a><a class="button secondary" href="#tienda">Seguir comprando</a></div></div>'
    : '<div class="panel"><h2>Tu cesta te está esperando.</h2><p>Elige una chapa para el collar o el arnés.</p><a class="button" href="#tienda">Explorar dispositivos</a></div>';
  renderSummary();
}
function renderSummary(){
  $('count').textContent=rows().reduce((total,p)=>total+cart[p.id],0);
  $('summary').textContent=rows().length?'Subtotal estimado '+euro(subtotal())+'. Comprueba el envío y el total en Revisar pedido.':'La cesta está vacía.';
  $('checkout').hidden=!rows().length;
}
function renderProducts(){
$('products').innerHTML=catalog.filter(p=>p.visible!==false).map(p=>'<article class="card"><a href="#producto/'+p.id+'">'+art(p)+'<h2>'+escape(p.name)+'</h2></a><p>'+escape(p.body)+'</p><p class="price">'+euro(p.price)+'</p><button data-add="'+p.id+'" '+(p.stock===0?'disabled':'')+'> '+(p.stock===0?'Agotado':'Añadir a la cesta')+'</button></article>').join('');
}
function route() {
  const [page,id]=location.hash.slice(1).split('/');
  const product=catalog.find(p=>p.id===id&&p.visible!==false);
  const target=page==='producto'&&!product?'tienda':(document.getElementById(page)?.classList.contains('page')?page:'inicio');
  document.querySelectorAll('.page').forEach(el=>el.hidden=el.id!==target);
  const navTarget={producto:'tienda',pedido:'carrito',pedidos:'carrito'}[target]||target;
  document.querySelectorAll('nav a').forEach(a=>{if(a.hash==='#'+navTarget) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current');});
  if(target==='producto') $('product').innerHTML='<div class="product-detail">'+art(product)+'<div><p class="eyebrow">ACCESORIOS NFC</p><h1>' +escape(product.name)+'</h1><p>'+escape(product.body)+'</p><p class="price">'+euro(product.price)+'</p><button data-add="'+product.id+'">Añadir a la cesta</button></div></div>';
  if(target!=='inicio') document.querySelector('.hero-media video').pause();
  if(target==='pedidos') $('orders').innerHTML=orders.length?orders.map(o=>'<article class="panel"><h2>'+escape(o.id)+'</h2><p>'+escape(o.alias)+' · '+euro(o.total)+'</p><p>'+escape(o.items.join(', '))+'</p></article>').join(''):'<p>Aún no hay pedidos guardados aquí.</p>';
  window.scrollTo(0,0);
}
$('checkout').elements.shipping.addEventListener('change',renderSummary);
let reviewedOrder=null;
let checkoutBusy=false;
function setCheckoutBusy(busy){
  checkoutBusy=busy;
  $('checkout').querySelector('button').disabled=busy;
}
function orderError(error){
  return error instanceof TypeError||error.name==='TimeoutError'?'No se pudo conectar con la tienda. Vuelve a intentarlo.':error.message;
}
$('checkout').addEventListener('submit',async event=>{
  event.preventDefault();
  if(checkoutBusy||!rows().length)return;
  const request={items:rows().map(p=>({id:p.id,quantity:cart[p.id]})),country:$('checkout').elements.shipping.value==='canarias'?'ES-CN':'ES-PB'};
  setCheckoutBusy(true);$('receipt').textContent='Consultando el total del pedido…';
  try{
    const previous=load('pending-sale',null);
    const selection=JSON.stringify(request);
    const pending=previous?.selection===selection?previous:{selection,token:crypto.randomUUID()};
    if(pending.quote){
      await confirmSale({...request,token:pending.token,quote:pending.quote});
      return;
    }
    const quote=await sales('cotizar',request);
    reviewedOrder={...request,token:pending.token,quote:quote.quote};
    $('order-preview').textContent='Productos '+euro(quote.subtotal*100)+' · Envío '+euro(quote.shipping*100)+(quote.tax?' · Impuestos '+euro(quote.tax*100):'')+(quote.handling?' · Otros gastos '+euro(quote.handling*100):'')+' · Total '+euro(quote.total*100);
    $('receipt').textContent='';
    const dialog=$('order-confirm');
    dialog.returnValue='';dialog.showModal();
  }catch(error){$('receipt').textContent=orderError(error);}
  finally{setCheckoutBusy(false);}
});
async function confirmSale(request){
  const {token,quote,...selection}=request;
  save('pending-sale',{selection:JSON.stringify(selection),token,quote});
  try{
    const result=await sales('pedido',request);
    localStorage.removeItem('mascotas:pending-sale');
    const order={id:result.id,alias:'TuInfoNFC Mascotas',items:request.items.map(item=>item.quantity+' × '+(catalog.find(p=>p.id===item.id)?.name||item.id)),total:Math.round(result.total*100)};
    orders=[order,...orders.filter(o=>o.id!==order.id)].slice(0,50);
    save('orders',orders);cart={};save('cart',cart);$('checkout').reset();renderCart();
    $('receipt').textContent='Pedido '+order.id+' registrado. ';
    const link=document.createElement('a');link.href='#pedidos';link.textContent='Ver pedidos';$('receipt').append(link);
  }catch(error){
    if(error.name!=='TypeError'&&error.name!=='TimeoutError'&&!error.message.startsWith('No se pudo'))localStorage.removeItem('mascotas:pending-sale');
    throw error;
  }
}
$('order-confirm').onclose=async()=>{
  const request=reviewedOrder;reviewedOrder=null;
  if(!request||$('order-confirm').returnValue!=='save'||checkoutBusy)return;
  setCheckoutBusy(true);
  try{await confirmSale(request);}
  catch(error){$('receipt').textContent=orderError(error);}
  finally{setCheckoutBusy(false);}
};
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
$('cart').addEventListener('change',event=>{
  const input=event.target.closest('input[data-count]');
  if(!input)return;
  if(!input.checkValidity()||!Number.isInteger(input.valueAsNumber)){
    input.value=cart[input.dataset.count];return;
  }
  setQty(input.dataset.count,input.valueAsNumber);
});
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  const d=button.dataset;
  if(d.add){setQty(d.add,(cart[d.add]||0)+1);location.hash='carrito';}
  if(d.qty)setQty(d.qty,(cart[d.qty]||0)+Number(d.delta));
  if(d.remove)setQty(d.remove,0);
  if(d.edit!==undefined){editIndex=Number(d.edit);Object.entries(profiles[editIndex]).forEach(([key,val])=>$('profile').elements[key].value=val);$('profile').elements.pet.focus();}
  if(d.delete!==undefined&&confirm('¿Quitar esta ficha guardada en el dispositivo?')){profiles.splice(Number(d.delete),1);editIndex=null;$('profile').reset();save('profiles',profiles);renderProfiles();}
  if(d.write!==undefined){
    const p=profiles[Number(d.write)];
    pendingWrite={kind:p.url?'url':'text',value:p.url||[p.pet,p.phone&&'Contacto: '+p.phone,p.notes].filter(Boolean).join('\n')};
    const dialog=$('write-confirm');
    $('write-preview').textContent=pendingWrite.value;
    $('replace-nfc').checked=false;
    $('write-approve').disabled=true;
    dialog.returnValue='';dialog.showModal();
  }
});
$('clear-data').onclick=()=>{
  if(!confirm('¿Borrar la cesta, las fichas y los pedidos guardados en este dispositivo?'))return;
  for(const key of ['cart','orders','profiles','pending-sale'])localStorage.removeItem('mascotas:'+key);
  cart={};orders=[];profiles=[];editIndex=null;
  $('profile').reset();$('checkout').reset();$('receipt').textContent='';$('orders').textContent='';
  $('nfc-status').textContent='';renderCart();renderProfiles();
  $('privacy-status').textContent='Datos locales borrados.';
};
let pendingWrite=null;
$('replace-nfc').onchange=()=>{$('write-approve').disabled=!$('replace-nfc').checked;};
$('write-confirm').onclose=()=>{
  const choice=pendingWrite;pendingWrite=null;
  if(choice&&$('write-confirm').returnValue==='write'&&$('replace-nfc').checked)nfc('write',choice.kind,choice.value);
};
window.addEventListener('hashchange',route);
renderProducts();renderCart();renderProfiles();route();
sales('catalogo').then(products=>{
  catalog=products;
  renderProducts();renderCart();
  if(location.hash.startsWith('#producto/'))route();
}).catch(()=>{});





