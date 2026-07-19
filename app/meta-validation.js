export function maskPageId(id){const value=String(id||"");return value.length<7?"••••":`${value.slice(0,3)}••••${value.slice(-3)}`}
