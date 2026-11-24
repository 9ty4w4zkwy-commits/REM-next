// Uniform chapter/episode picker across iOS, Android and desktop.
// Keeps the native <select> in the DOM as the source of truth and dispatches change.
export function chapterPicker(select){
 const wrapper=document.createElement('div');
 wrapper.className='rem-chapter-picker';
 const trigger=document.createElement('button');
 trigger.type='button';trigger.className='rem-chapter-picker-trigger';
 const label=document.createElement('span');label.className='rem-chapter-picker-value';
 const arrow=document.createElement('span');arrow.className='rem-chapter-picker-arrow';arrow.textContent='⌄';arrow.setAttribute('aria-hidden','true');
 const title=select.getAttribute('aria-label')||'Scegli il capitolo';
 trigger.setAttribute('aria-label',title);
 trigger.setAttribute('aria-haspopup','dialog');
 trigger.setAttribute('aria-expanded','false');
 const refresh=()=>{label.textContent=select.selectedOptions[0]?.textContent?.trim()||'Seleziona un capitolo'};
 trigger.append(label,arrow);
 select.classList.add('rem-chapter-picker-native');
 select.tabIndex=-1;
 select.setAttribute('aria-hidden','true');
 wrapper.append(select,trigger);
 refresh();
 select.addEventListener('change',refresh);
 trigger.addEventListener('click',()=>{
  const existing=document.querySelector('.rem-chapter-picker-overlay');
  if(existing)existing.dispatchEvent(new Event('rem-close-picker'));
  const overlay=document.createElement('div');overlay.className='rem-chapter-picker-overlay';
  const dialog=document.createElement('section');dialog.className='rem-chapter-picker-dialog';
  dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',title);
  const header=document.createElement('div');header.className='rem-chapter-picker-header';
  const heading=document.createElement('span');heading.textContent=title;heading.className='rem-chapter-picker-heading';
  const dismiss=document.createElement('button');dismiss.type='button';dismiss.className='rem-chapter-picker-dismiss';dismiss.textContent='✕';dismiss.setAttribute('aria-label','Chiudi il menu senza cambiare capitolo');
  header.append(heading,dismiss);
  const list=document.createElement('div');list.className='rem-chapter-picker-list';list.setAttribute('role','listbox');
  list.setAttribute('aria-label',title);
  let selectedButton=null;
  const close=(restore=true)=>{
   overlay.remove();trigger.setAttribute('aria-expanded','false');
   document.removeEventListener('keydown',keyboard);
   if(restore&&trigger.isConnected)trigger.focus({preventScroll:true});
  };
  const keyboard=e=>{
   if(e.key==='Escape'){e.preventDefault();close()}
   if(e.key==='Tab'){e.preventDefault();const items=[dismiss,...list.querySelectorAll('button')];const idx=items.indexOf(document.activeElement);items[(idx+(e.shiftKey?-1:1)+items.length)%items.length]?.focus()}
  };
  for(const option of select.options){
   const row=document.createElement('button');row.type='button';row.className='rem-chapter-picker-option';
   row.setAttribute('role','option');
   const selected=option.value===select.value;
   row.setAttribute('aria-selected',String(selected));
   if(selected){row.classList.add('is-selected');selectedButton=row}
   const check=document.createElement('span');check.className='rem-chapter-picker-check';check.textContent=selected?'✓':'';
   check.setAttribute('aria-hidden','true');
   const text=document.createElement('span');text.className='rem-chapter-picker-option-text';text.textContent=option.textContent;
   row.append(check,text);
   row.addEventListener('click',()=>{
    if(select.value!==option.value){
     select.value=option.value;
     refresh();
     select.dispatchEvent(new Event('change',{bubbles:true}));
    }
    close();
   });
   list.append(row);
  }
  dismiss.addEventListener('click',()=>close());
  overlay.addEventListener('rem-close-picker',()=>close(false),{once:true});
  dialog.append(header,list);overlay.append(dialog);
  overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
  document.body.append(overlay);trigger.setAttribute('aria-expanded','true');
  document.addEventListener('keydown',keyboard);
  (selectedButton||list.querySelector('button'))?.focus({preventScroll:true});
  if(selectedButton)list.scrollTop=Math.max(0,selectedButton.offsetTop-list.offsetTop-list.clientHeight/2+selectedButton.clientHeight/2);
 });
 return wrapper;
}
