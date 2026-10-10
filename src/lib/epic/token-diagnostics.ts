import type { ClientAuthMethod } from './config';
const oauthErrors=new Set(['invalid_client','invalid_grant','invalid_request','invalid_scope','unauthorized_client','access_denied','unsupported_grant_type','server_error','temporarily_unavailable']);
// An upstream error may echo secrets. Only these fixed, credential-free messages
// may appear verbatim in logs; never log arbitrary response text or headers.
const safeDescriptions=new Set(['Invalid client','Invalid client.','Client authentication failed','Client authentication failed.','Invalid client credentials','Invalid client credentials.','The client authentication failed.','Invalid authorization code','Invalid authorization code.']);
export function tokenFailureDiagnostic(status:number,result:unknown,method:ClientAuthMethod,pkce:boolean) {
 const body=result && typeof result==='object'?result as Record<string,unknown>:{};
 const error=typeof body.error==='string' && oauthErrors.has(body.error)?body.error:'unrecognized_or_missing';
 const description=body.error_description===null?null:typeof body.error_description==='string'?(safeDescriptions.has(body.error_description)?body.error_description:'[suppressed: unrecognized upstream description]'):'[not provided]';
 return {event:'epic_token_exchange_failed',httpStatus:status,oauthError:error,oauthErrorDescription:description,authenticationMethod:method,method:'POST',contentType:'application/x-www-form-urlencoded',grantType:'authorization_code',pkceVerifierIncluded:pkce};
}
export function reportTokenFailure(status:number,result:unknown,method:ClientAuthMethod,pkce:boolean) {
 const diagnostic=tokenFailureDiagnostic(status,result,method,pkce);
 console.warn('[ClearPath Epic token exchange]',JSON.stringify(diagnostic));
 return diagnostic;
}
