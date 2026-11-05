"use client";

import { useState } from "react";

// ISO country → dial code. Names come from Intl.DisplayNames, flags from regional-indicator emoji.
const CODES = "IN:91,US:1,GB:44,AE:971,SG:65,AU:61,CA:1,DE:49,FR:33,NL:31,SA:966,QA:974,KW:965,OM:968,BH:973,NP:977,LK:94,BD:880,PK:92,BT:975,MV:960,AF:93,MM:95,TH:66,MY:60,ID:62,PH:63,VN:84,KH:855,LA:856,CN:86,HK:852,TW:886,JP:81,KR:82,NZ:64,ZA:27,NG:234,KE:254,GH:233,EG:20,MA:212,DZ:213,TN:216,ET:255,TZ:255,UG:256,IE:353,ES:34,PT:351,IT:39,CH:41,AT:43,BE:32,LU:352,SE:46,NO:47,DK:45,FI:358,IS:354,PL:48,CZ:420,SK:421,HU:36,RO:40,BG:359,GR:30,TR:90,CY:357,MT:356,UA:380,RU:7,KZ:7,UZ:998,GE:995,AM:374,AZ:994,IL:972,JO:962,LB:961,IQ:964,IR:98,MX:52,BR:55,AR:54,CL:56,CO:57,PE:51,VE:58,EC:593,UY:598,PA:507,CR:506,DO:1,JM:1,TT:1,MU:230,FJ:679";
const names = new Intl.DisplayNames(["en"], { type: "region" });
const flag = (c: string) => String.fromCodePoint(...[...c].map((ch) => 127397 + ch.charCodeAt(0)));
const LIST = CODES.split(",").map((s) => {
  const [iso, dial] = s.split(":");
  return { iso, dial, label: `${flag(iso)} ${names.of(iso)} (+${dial})` };
}).sort((a, b) => (a.iso === "IN" ? -1 : b.iso === "IN" ? 1 : a.label.slice(5).localeCompare(b.label.slice(5))));

// Splits a stored "+91 98765 43210" into [iso, rest]; unknown/no prefix → India.
function split(v: string): [string, string] {
  const m = v.trim().match(/^\+(\d+)[\s-]*(.*)$/);
  if (!m) return ["IN", v.trim()];
  for (let n = Math.min(3, m[1].length); n > 0; n--) {
    const hit = LIST.find((c) => c.dial === m[1].slice(0, n));
    if (hit) return [hit.iso, (m[1].slice(n) + (m[2] ? " " + m[2] : "")).trim()];
  }
  return ["IN", v.trim()];
}

export function PhoneInput({ name, defaultValue = "", required, placeholder, autoComplete, className = "input h-10" }: {
  name: string; defaultValue?: string; required?: boolean; placeholder?: string; autoComplete?: string; className?: string;
}) {
  const [init] = useState(() => split(defaultValue));
  const [iso, setIso] = useState(init[0]);
  const [num, setNum] = useState(init[1]);
  const dial = LIST.find((c) => c.iso === iso)!.dial;
  return (
    <span className="flex gap-2">
      <select value={iso} onChange={(e) => setIso(e.target.value)} className={`${className} w-auto max-w-[45%] shrink-0`} aria-label="Country code">
        {LIST.map((c) => <option key={c.iso} value={c.iso}>{c.label}</option>)}
      </select>
      <input type="tel" value={num} onChange={(e) => setNum(e.target.value)} required={required} placeholder={placeholder ?? "98765 43210"} autoComplete={autoComplete} className={`${className} min-w-0 flex-1`} />
      <input type="hidden" name={name} value={num.trim() ? `+${dial} ${num.trim()}` : ""} />
    </span>
  );
}
