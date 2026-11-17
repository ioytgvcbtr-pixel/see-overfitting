let fallback:Promise<unknown>|undefined;
export function enableFocusgroup(){
 if(!Object.hasOwn(HTMLElement.prototype,'focusGroup'))fallback??=import('@microsoft/focusgroup-polyfill').then(({polyfillBodyAndObserve})=>polyfillBodyAndObserve());
 return fallback;
}
