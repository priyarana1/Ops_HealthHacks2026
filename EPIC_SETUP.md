# Epic-only local development

This workflow requires neither MongoDB nor AWS. Existing database, transcription, AI and patient-publishing modules remain in the repository for later configuration. Only synthetic sandbox charts are allowed.

## Required local environment

Keep the existing `.env.local` and your registered values. Next.js loads it server-side automatically. Do not commit it or share the secret in chat.

```dotenv
APP_URL=http://localhost:3000
EPIC_FHIR_BASE_URL=https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/
EPIC_CLIENT_ID=<your registered NON-PRODUCTION client ID>
EPIC_CLIENT_SECRET=<your actual sandbox secret>
EPIC_REDIRECT_URI=http://localhost:3000/api/epic/callback
EPIC_TOKEN_AUTH_METHOD=client_secret_basic
EPIC_SCOPES=openid
```

The callback must be registered **exactly**, including protocol, hostname, port and path. `APP_URL` must match its origin. `EPIC_CLIENT_SECRET` and the non-production client ID are already populated in this checkout; the implementation did not change or print their values.

`EPIC_TOKEN_AUTH_METHOD` defaults to `client_secret_basic` when a secret exists. Select `client_secret_post` only if that is your app's configured method. The Basic flow form-encodes each credential before Base64 encoding and omits `client_id` from the token body, per Epic documentation.

Empty `EPIC_SCOPES` defaults to `openid`, which Epic documents as sufficient to start sandbox authorization. This does **not** grant every FHIR API: enable the appropriate APIs in Epic registration. Add `fhirUser` and any resource scopes only when registered and supported. `openid fhirUser` allows a verified Practitioner reference to be displayed if Epic returns it. Without `fhirUser`, the portal displays the verified OpenID subject; it never invents a clinician name. Optional Practitioner.Read/PractitionerRole.Read permissions allow profile enrichment. Do not request launch/patient or launch/encounter for this standalone clinician flow; patient selection is explicit.

Required read/search APIs for this prototype: Patient.Read/Patient.Search (if searching by name), Encounter.Search, Condition.Search, MedicationRequest.Search, DocumentReference.Search. MedicationStatement, Appointment and referenced Binary are optional and display their own availability/permission status. Select the matching R4 APIs offered by the Epic registration UI. A registered Patient.Read alone can support a known sandbox FHIR Patient ID even when Patient.Search is unavailable.

MongoDB/AWS values can stay empty. No placeholder credentials are used. `AUTH_SECRET` is optional for **local development only**: when absent, a random server-memory secret is generated and lost on restart. Set your own random secret (at least 32 characters) if desired. Provider/Epic sessions are server-memory records during development regardless of MongoDB configuration; they are deliberately not durable.

## Optional private_key_jwt alternative

Only use this when the corresponding public key/JWK Set is registered with Epic for the confidential application:

```dotenv
EPIC_TOKEN_AUTH_METHOD=private_key_jwt
EPIC_PRIVATE_KEY_PATH=/absolute/path/to/your/private-key.pkcs8.pem
EPIC_PRIVATE_KEY_ID=<kid matching the registered public key, when applicable>
EPIC_PRIVATE_KEY_ALG=RS384
```

`EPIC_PRIVATE_KEY_PEM` is an alternative to the path and supports escaped newlines. Supported algorithms are RS384 and ES384. Assertions have a unique jti, client-ID issuer/subject, the discovered token URL as audience, and a four-minute expiration. Do not commit private keys or use a generated test key as a registered credential. No credentials or keys were generated for your Epic registration by this implementation.

## Start and test

```sh
cd /Users/radhaghate/Programs/health-hacks-2026/Ops_HealthHacks2026
npm install
npm run typecheck
npm run lint
npm test
npm run dev
```

`npm run dev` binds to 127.0.0.1. Open **http://localhost:3000**, matching `APP_URL` (do not switch the browser to 127.0.0.1 unless you also change and register that callback).

1. Open `/provider`. You will be directed to `/signin`.
2. If provider credentials are empty, choose **Open local provider workspace**. This is an explicitly labeled development-only, loopback-only workspace; it issues an opaque HTTP-only server session and does not claim you have authenticated as an Epic clinician. Configured provider credentials instead require the normal sign-in form. Production never permits this entry path.
3. On `/provider`, choose **Connect to Epic Sandbox**. The server discovers Epic's authorization/token endpoints, stores a five-minute single-use state and PKCE verifier on the server, and navigates the browser to Epic.
4. Authenticate on Epic's own page using its current **clinician/staff sandbox** test user credentials. Do not use a MyChart patient account. ClearPath never collects this password. Use Epic's current sandbox testing documentation for the credentials; this repository does not invent or store them.
5. After consent, the registered `/api/epic/callback` checks the current provider session and state, exchanges the code on the server using the configured confidential method, verifies the OpenID token's signature/issuer/audience/expiration/nonce, encrypts the access token in the server store, and returns to `/provider`.
6. Confirm the Connected indicator, verified clinician subject/reference or permitted display name, grant scopes, and expiration. `/api/epic/status` is authenticated and returns no access/refresh/identity token, secret, code, nonce or encrypted-token field.
7. Search for a known synthetic patient by name. If search is not enabled, copy a **FHIR Patient ID** from Epic's sandbox test data and choose **Read synthetic test patient**. This is an authorized chart read, not patient login and not MRN authentication. Clinician standalone login is not assumed to provide a Patient or Encounter ID.
8. Select the returned patient and inspect Patient identification plus the Encounter, Condition, MedicationRequest and DocumentReference results. Each search is independent. Empty, unsupported, denied and failed results stay distinct; a real API failure never becomes fake chart data. The initial page is capped at 50 resources and flags additional pages rather than silently claiming completeness.
9. Choose **Import chart into discharge workspace**. Select an encounter if available, and paste/upload finalized synthetic AVS text. The issuer, FHIR Patient ID and selected Encounter ID remain distinct. No returned note/CDA is claimed to be finalized AVS.
10. With no MongoDB, choose **Prepare temporary discharge draft** to preview the selected chart and AVS in the current page. It is explicitly not saved or published, and disappears on reload. AI/audio/database publishing are not implied to have run. Once MongoDB is configured, the existing server-owned saving workflow can persist the same references.
11. Disconnect Epic or sign out. Status/chart endpoints must then deny access. Restarting the dev server invalidates provider sessions and Epic tokens; reconnect to continue.

## Manual registration checks and common failures

- App user type: **Clinicians, Staff, or Administrative Users**, not patient-facing or backend client_credentials.
- SMART/FHIR version: R4; sandbox-ready, non-production ID and matching secret/public key.
- Exact redirect URI above; ensure server and registration agree. Do not change the URI after starting authorization.
- Confirm the configured token authentication method and enabled OpenID/FHIR APIs; registration changes can require propagation time.
- `invalid_client`: wrong secret, wrong non-production ID, method mismatch, or private-key/public-key mismatch.
- `invalid_grant`: code expired/reused, incorrect redirect or PKCE mismatch. Start a new connection.
- 403: missing registered APIs, missing FHIR scopes or user permissions; check each denied resource. Identity-only token scopes do not replace Epic's registration-level permissions.
- 401: short-lived token expired/revoked; reconnect. Refresh tokens are not requested or retained.
- Missing records: use a documented synthetic test patient; Patient.Search is not assumed to enumerate every chart or support every search parameter.
- Missing display name: verified subject remains available; enable fhirUser and the relevant Practitioner profile permissions if needed.
- Multiple worker/process deployments: in-memory development sessions are unsuitable; configure durable production storage and real provider authentication. Production fails closed without AUTH_SECRET/database/provider credentials.
- Real Epic network failure: investigate DNS/network access; no mock fallback exists.

## Verification recorded in this session

`npm run typecheck`, `npm run lint`, unit tests and `npm run build` were run with installed dependencies. See README for final counts. OAuth tests use synthetic HTTP fixtures and locally generated test signing keys, never the real sandbox secret. They cover state/PKCE, Basic encoding, client_secret_post, private_key_jwt, signed clinician identity/nonce, replay/session mismatch, token errors, explicit patient search/read, resource statuses and expiration without any MongoDB/AWS connection.

The execution sandbox blocked binding `127.0.0.1:3000` (`EPERM`) and could not resolve `fhir.epic.com`. Thus a real browser authorization/token exchange and live chart fetch have **not** been verified here. Complete steps 1–8 on your local machine to verify the registered app.

Official references: [Epic OAuth, standalone launch, confidential clients, OpenID verification and sandbox test data](https://fhir.epic.com/Documentation), [Epic public R4 sandbox](https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/).
