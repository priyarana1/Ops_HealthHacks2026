import { createHash } from 'node:crypto';
import { AppError } from '@/lib/security/core';
import { discovery, epicConfig } from './config';
import { authorizationRequest } from './auth';

// Explicit allowlist: never return a request URL, incoming query, or OAuth attempt.
export async function authorizationDiagnostics() {
 if(process.env.NODE_ENV==='production')throw new AppError(404,'Epic endpoint not found.');
 const config=epicConfig(),metadata=await discovery();
 const preview=authorizationRequest(config,metadata,'diagnostic-only','diagnostic-only','diagnostic-only');
 return {
  developmentOnly:true,launchType:'standalone clinician',discoverySucceeded:true,
  authorizationEndpoint:metadata.authorize,tokenEndpoint:metadata.token,
  parameterNames:[...preview.searchParams.keys()].sort(),
  values:{client_id:'[redacted]',response_type:'code',redirect_uri:config.redirect,scope:config.scope,aud:config.base,state:'[redacted]',nonce:'[redacted]',...(metadata.pkce?{code_challenge:'[redacted]',code_challenge_method:'S256'}:{})},
  configuration:{clientIdConfigured:true,clientIdFingerprint:createHash('sha256').update(config.clientId).digest('hex').slice(0,12),clientIdLooksLikeUuid:/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(config.clientId),nonProductionIdVerified:false,tokenAuthenticationMethod:config.authMethod,clientSecretConfigured:!!process.env.EPIC_CLIENT_SECRET,privateKeyConfigured:!!(process.env.EPIC_PRIVATE_KEY_PEM || process.env.EPIC_PRIVATE_KEY_PATH),pkce:metadata.pkce?'S256':'not advertised as supported'},
  portalChecks:['Compare EPIC_CLIENT_ID locally with the app’s Non-Production Client ID; UUID format alone cannot verify this.','Register the exact redirect URI shown above, with no trailing slash.','Confirm clinician/user-facing standalone access and the configured confidential-client method.','Confirm the requested identity scopes and incoming FHIR APIs are enabled.'],
 };
}
