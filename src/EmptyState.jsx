import React from "react";
import "./empty-state.css";

/* Shared empty-state illustration set. One plate, one stroke weight, one grey so
   every table in the product reads the same when it has no records. The shape
   classes drive the motion in empty-state.css: emptyBar grows from the baseline,
   emptyDraw sketches itself on, emptyDrawLate waits for the shape before it and
   emptyDot simply breathes. */
const ART = {
  budget: <>
    <rect className="emptyBar" x="32" y="54" width="8" height="14" rx="2.5"/>
    <rect className="emptyBar" x="44" y="44" width="8" height="24" rx="2.5"/>
    <rect className="emptyBar" x="56" y="50" width="8" height="18" rx="2.5"/>
    <path className="emptyDraw" d="M30 70h36"/>
  </>,
  lock: <>
    <rect className="emptyDraw" x="34" y="46" width="28" height="22" rx="6"/>
    <path className="emptyDraw emptyDrawLate" d="M40 46v-6a8 8 0 0 1 16 0v6"/>
    <path className="emptyDot" d="M48 55v4"/>
  </>,
  request: <>
    <rect className="emptyDraw" x="30" y="38" width="36" height="26" rx="5"/>
    <path className="emptyDraw emptyDrawLate" d="M32 42l16 11 16-11"/>
  </>,
  journal: <>
    <path className="emptyDraw" d="M36 30h16l12 12v24H36z"/>
    <path className="emptyDraw" d="M52 30v12h12"/>
    <path className="emptyDraw" d="M42 52h12"/>
    <path className="emptyDraw" d="M42 60h12"/>
  </>,
  adjustment: <>
    <path className="emptyDraw" d="M32 42l16-8 16 8v18l-16 8-16-8z"/>
    <path className="emptyDraw" d="M32 42l16 8 16-8"/>
    <path className="emptyDraw" d="M48 50v18"/>
  </>,
  default: <>
    <path className="emptyDraw" d="M32 40h32v26H32z"/>
    <path className="emptyDraw" d="M32 52h9l3 5h10l3-5h9"/>
  </>
};

export function EmptyIllustration({variant="default"}){
  return <svg className="emptyArt" viewBox="0 0 96 96" aria-hidden="true" focusable="false">
    <rect className="emptyArtPlate" x="10" y="10" width="76" height="76" rx="18"/>
    <g className="emptyArtGlyph">{ART[variant]||ART.default}</g>
  </svg>;
}

export default function EmptyState({variant="default",title,description,action,actionLabel,onAction,className=""}){
  const cta=action||(actionLabel&&onAction?<button type="button" className="emptyCta" onClick={onAction}>{actionLabel}</button>:null);
  return <div className={"emptyState"+(className?" "+className:"")}>
    <EmptyIllustration variant={variant}/>
    {title?<h3 className="emptyTitle">{title}</h3>:null}
    {description?<p className="emptyText">{description}</p>:null}
    {cta?<div className="emptyAction">{cta}</div>:null}
  </div>;
}