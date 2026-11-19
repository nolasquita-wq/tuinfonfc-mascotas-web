import {attachAddress,disabledConfig} from './address-helper.mjs';
// Activation additionally requires a server endpoint, privacy review and an explicit configuration.
const config=globalThis.TUINFO_ADDRESS_CONFIG || disabledConfig;
for(const form of document.forms){
 for(const prefix of ['', 'billing']){
  const name=key=>prefix?prefix+key[0].toUpperCase()+key.slice(1):key;
  attachAddress(form,Object.fromEntries(['country','street','postal','city','region'].map(k=>[k,name(k)])),config);
 }
}
