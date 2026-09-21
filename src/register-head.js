/* One scroll behaviour for every table page.

   Three things are handled here, once, for the whole application, so a page never
   writes its own scroll logic:

   1. The merged page heading row (`registerHead`) pins to the top of the shell
      scroll port, slides away once the reader has clearly started scrolling down,
      and returns on the first upward scroll or at the very top. The threshold is
      deliberate - a nudge or a rubber-band bounce must not move the page context.
   2. The page's table is marked `data-sticky-head` so its column heading row pins
      directly beneath that heading row, and takes its place when the row slides
      away. The measured heading height is published as `--register-head-h`, and as
      `0px` while the row is hidden, so the two rows hand over without a jump.
   3. A table wrapper that is a scroll container is released to `overflow:visible`
      only while that table fits it horizontally. A scroll container is the sticky
      position's containing block, so a heading inside one would pin to a box that
      never scrolls and never appear to pin at all; but a wrapper that genuinely
      scrolls sideways keeps its scrolling and simply does not pin its heading.

   The listener is installed once on the document in the capture phase, because a
   scroll event does not bubble and the shell's scroll port is not guaranteed to
   exist when this module is loaded. `MutationObserver` re-runs the discovery when
   the page changes, coalesced to one run per animation frame, so a route change or
   a filtered table is picked up without a per-scroll cost. */
export function installRegisterHead(){
  if(window.__wayvidaRegisterHead)return;
  window.__wayvidaRegisterHead=true;

  /* How far the reader has to scroll before the page context gives way to the table. */
  const HIDE_AFTER=48;
  /* The two top-level scroll ports. Period Lock is a fixed panel with its own, which is why it is
     not `.app>main`. */
  const SCOPES='.app>main,.pc';
  /* A table inside one of these is a section, a form or a document preview, not the page's grid. */
  const EXCLUDE='form,dialog,[role=dialog],details,.ivOverlay,.ivDetailSheet,.ivDetailBody,.dpPaper,.jp-page,.jp-sheet,.ivCreateForm,.itemCreatePage,.soCreatePage,.budgetWizard,.am-create-drawer';
  const offsets=new WeakMap();
  let table=null,wrap=null,frame=0;

  const row=()=>document.querySelector('.registerHead');

  /* The height the sticky column heading has to clear: the heading row while it is there, nothing
     while it has slid away or when the page has no such row. */
  const measure=()=>{
    const h=row();
    document.documentElement.style.setProperty('--register-head-h',h&&!h.classList.contains('isHidden')?h.offsetHeight+'px':'0px');
    /* The scroll port own top padding: a sticky offset is measured from its content box, so the
       heading has to give that padding back or it pins below the visible top edge and leaves a band
       the rows scroll through. */
    /* Whichever port this page scrolls in - the shell main, or the Period Lock panel, which owns
       its own - and that port own top padding. */
    const anchor=row()||table, panel=document.querySelector('.pc');
    const box=anchor&&panel&&panel.contains(anchor)?panel:document.querySelector('.app>main');
    document.documentElement.style.setProperty('--register-head-pad',((box?parseFloat(getComputedStyle(box).paddingTop):0)||0)+'px');
  };

  /* The page's own grid: the first table in the scroll port that carries headings and is not part
     of a form, a dialog or a preview. One per page, so a summary table further down is left alone. */
  const findTable=()=>{
    for(const scope of document.querySelectorAll(SCOPES)){
      const found=[...scope.querySelectorAll('table')].find(el=>el.tHead&&el.tHead.rows.length&&!el.closest(EXCLUDE));
      if(found)return found;
    }
    return null;
  };

  /* The nearest box that would scroll instead of the page, if there is one. */
  const scrollBox=el=>{
    for(let node=el.parentElement;node;node=node.parentElement){
      if(node.matches&&node.matches(SCOPES))return null;
      const style=getComputedStyle(node);
      if(/(auto|scroll|hidden)/.test(style.overflowY+style.overflowX))return node;
    }
    return null;
  };

  const mark=()=>{
    const found=findTable();
    if(found!==table){
      if(wrap)wrap.classList.remove('stickyHeadWrap');
      if(table)table.removeAttribute('data-sticky-head');
      table=found;
      wrap=null;
      if(!table)return;
      table.setAttribute('data-sticky-head','');
      const box=scrollBox(table);
      if(box){wrap=box;box.classList.toggle('stickyHeadWrap',box.scrollWidth<=box.clientWidth+1)}
      return;
    }
    /* The same table can start or stop fitting its wrapper as the viewport changes. */
    if(wrap)wrap.classList.toggle('stickyHeadWrap',wrap.scrollWidth<=wrap.clientWidth+1);
  };

  const sync=()=>{
    mark();
    measure();
  };

  const schedule=()=>{
    if(frame)return;
    frame=requestAnimationFrame(()=>{frame=0;sync()});
  };

  const onScroll=event=>{
    const scroller=event.target;
    if(!scroller||typeof scroller.matches!=='function'||!scroller.matches(SCOPES))return;
    const h=row();
    if(!h)return;
    const y=scroller.scrollTop,last=offsets.get(scroller)??y,delta=y-last;
    offsets.set(scroller,y);
    const next=y>HIDE_AFTER&&delta>0&&y>h.offsetHeight;
    if(h.classList.contains('isHidden')!==next){
      h.classList.toggle('isHidden',next);
      measure();
    }
  };

  document.addEventListener('scroll',onScroll,{capture:true,passive:true});
  /* A page action can be focused while the row is away - by tabbing, or by a shortcut - so the row
     comes back rather than leaving the focused control off screen. */
  document.addEventListener('focusin',event=>{
    const h=row();
    if(h&&h.contains(event.target)&&h.classList.contains('isHidden')){h.classList.remove('isHidden');measure()}
  });
  window.addEventListener('resize',schedule);
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
  sync();
}
