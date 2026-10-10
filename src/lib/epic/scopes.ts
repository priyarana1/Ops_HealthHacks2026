/** Epic may return identity-only scopes and authorize resources from registered APIs.
 * Only locally deny when explicit FHIR grants are present and exclude this operation. */
export function resourcePermission(scope:string,resource:string,search=false):boolean|undefined {
 const tokens=scope.split(/\s+/);
 const grants=tokens.map(s=>s.match(/^(?:(?:user|patient|system)\/)?([A-Z][A-Za-z]+|\*)\.([a-z*]+)$/)).filter((m):m is RegExpMatchArray=>!!m);
 if(!grants.length)return undefined;
 return grants.some(m=>(m[1]===resource || m[1]==='*') && (m[2]==='*' || (search?['read','search'].includes(m[2]) || (/^[cruds]+$/.test(m[2]) && m[2].includes('s')):m[2]==='read' || (/^[cruds]+$/.test(m[2]) && m[2].includes('r')))));
}
