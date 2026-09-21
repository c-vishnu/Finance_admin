/* The date ranges every register filter offers, resolved in one place so five pages cannot disagree
   about what "this week" means.

   Each range is the whole calendar period, not the part of it that has already happened: a filter
   labelled This month has to include a document dated later in the same month, and one labelled
   This year has to include December. Weeks run Monday to Sunday, which is the working week the
   rest of the app assumes.

   The two dates stay the only filter state, so choosing a range simply writes the page existing
   from and to fields: every page keeps its own filtering, its own count badge and its own Clear
   filters row without changing any of them. */
export const DATE_RANGE_PRESETS=[
 ['all','All dates'],
 ['day','Today'],
 ['week','This week'],
 ['month','This month'],
 ['year','This year'],
];

const iso=date=>date.toLocaleDateString('en-CA');

export function resolveDateRange(key,today=new Date()){
 const y=today.getFullYear(),m=today.getMonth(),d=today.getDate();
 if(key==='day')return {from:iso(today),to:iso(today)};
 if(key==='week'){const back=(today.getDay()+6)%7,start=new Date(y,m,d-back),end=new Date(y,m,d-back+6);return {from:iso(start),to:iso(end)}}
 if(key==='month')return {from:iso(new Date(y,m,1)),to:iso(new Date(y,m+1,0))};
 if(key==='year')return {from:iso(new Date(y,0,1)),to:iso(new Date(y,11,31))};
 return {from:'',to:''};
}

/* What the control should read for the dates it is holding: a named range only while the two dates
   are exactly that period, so it never claims a range the reader has since edited by hand. */
export function matchDateRange(from,to,today=new Date()){
 if(!from&&!to)return 'all';
 for(const [key] of DATE_RANGE_PRESETS){
  if(key==='all')continue;
  const range=resolveDateRange(key,today);
  if(range.from===from&&range.to===to)return key;
 }
 return 'custom';
}

/* The label of the range the two dates currently describe, named or custom. */
export function dateRangeLabel(from,to,today=new Date()){
 const key=matchDateRange(from,to,today);
 const found=DATE_RANGE_PRESETS.find(([value])=>value===key);
 return found?found[1]:'Custom range';
}
