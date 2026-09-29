# Native Android client (stage 1)

This project is the first Android client stage. It is Kotlin/Jetpack Compose with Room, SQLCipher and WorkManager. It is intentionally isolated under `android/`; it does not change the PHP/backend application.

## Build setup

Install JDK 17, Android SDK Platform 35 and Android Build Tools 35.0.0. The checked-in Gradle wrapper downloads Gradle 8.9. Set `ANDROID_SDK_ROOT` (or configure the SDK location in an untracked `local.properties`). From this directory:

```sh
./gradlew :app:testDebugUnitTest
./gradlew :app:assembleDebug -PGRAPHQL_ENDPOINT=https://api.example.invalid/graphql
```

The endpoint above is a placeholder, not a working service. Configure the deployed TLS GraphQL endpoint with `-PGRAPHQL_ENDPOINT=https://host/path`; the value is compiled into `BuildConfig.GRAPHQL_ENDPOINT`. Do not put credentials in Gradle properties, source files, or this documentation.

For a temporary physical-device test on a trusted private Wi-Fi, build the debug APK with the computer's current LAN address, for example:

```sh
./gradlew :app:assembleDebug -PGRAPHQL_ENDPOINT=http://192.168.1.53:3000/graphql
```

The debug manifest alone permits HTTP; the main manifest still disallows cleartext for non-debug builds. Use a test account only: credentials and API traffic are unencrypted over HTTP. Do not use this endpoint on public/shared Wi-Fi or in a release APK. The phone and computer must be on the same network, and the computer firewall must allow port 3000.

The app targets API 35, supports API 26+, and uses the Kotlin 2.0.21 / AGP 8.7.3 toolchain. Tests cover queue state transitions, idempotent operation identity, dependency readiness, retry decisions, GraphQL documents/DTOs, and the strict customer/credit/payment payload mappings (including payment signs and entity IDs).

## Server contract

`network/GraphQlDocuments.kt` is the single source for GraphQL documents and is aligned to `src/graphql/schema.ts` and `src/services/queries.ts`. Login passes an integer `companyId` and parses `token`, `expiresIn`, `user`, `company`, and `branches`. Branch IDs/customer IDs use GraphQL `Int`; GraphQL `ID` values accept their numeric JSON representation. The typed OkHttp client calls `login`, `me`, `branches`, `portfolio`, `customerById`, `customerByDocument`, `paymentHistory`, `syncChanges`, and `applyOfflineOperation`.

Portfolio pages use `nodes: Customer[]` with the schema's customer fields and embedded `credits`/`comments`, plus `snapshotCursor`, `nextCursor`, and `hasNextPage`. Payment history uses `amount`, `description`, `state`, `createdAt`, `updatedAt`, and `routeId`. `syncChanges` requires an `after` cursor and returns `nodes` containing `cursor`, `recordType`, `recordId`, `action`, `createdAt`, and JSON `payload`. The mutation accepts `OfflineOperationInput` and returns `operationId`, `status`, `entityId`, `data`, `eventCursor`, and `replayed`. `payload` is sent as JSON. The server remains authoritative.

The client does not implement or simulate backend validation. Keep documents and typed DTOs aligned if the schema changes. Server acknowledgements are interpreted only after the returned operation ID matches and the status indicates application; after acknowledgement, the client pulls changes from its saved cursor through the returned event cursor before advancing the queue.

## Offline behavior and local data

- First sign-in requires an online server login. The password is only held in UI memory while submitting and is never stored in preferences, Room, or the offline queue.
- Offline unlock uses the device's biometric or screen-lock credential to open the local app. It does **not** authenticate to the server or renew a token.
- Only the selected branch's portfolio-linked customer/card records, the customer fields needed by the typed update form, and fetched payment history are cached. A customer fetched by ID or document is also saved when explicitly opened. The app does not download the company's complete customer directory.
- The portfolio card shows the latest cached `tbl_descripcion` record by type and detail (payment, `c-Inicial`, initial installment, discount, interest, correction, or cancellation). Only `Abono` and `c-Inicial` authored by the signed-in user with `created`/`entregando` state have green backgrounds (`#4b965b`/`#1f5b2c`); unknown or other authors appear gray. The creator's first and last names are title-cased in the UI. Pending device-created payments still show their separate queue/synchronization status and are not presented as server-confirmed.
- The portfolio uses a two-tap card: the first tap moves the pointer to that card (outlined border plus an "Aquí vas" marker) and the second tap on the same card opens it to read or enter payments. The pointer survives screen changes, configuration changes, and process death, and the cartera keeps its own scroll state, so returning from any other screen scrolls the pointed card back into view instead of jumping to the top. The pointer is cleared when the branch changes, when the pointed card leaves the cache, and on logout.
- A fixed bottom bar replaces the stacked buttons that used to scroll away with the list: `‹`/`›` step the pointer through the currently filtered portfolio (disabled at both ends and outside the cartera, and they never open the card), a home button returns to the cartera and restores the pointer's scroll position, a starred-cards button opens the marked list with its own counter, a boxed number shows the pointed card's position and scrolls it back into view, and an overflow menu carries every remaining action with the unresolved-queue count as its badge. The bar is hidden on the login and branch pickers.
- On the payments screen the overflow menu also carries the seven card actions (edit, change status, reorder, discount, interest, refresh payments, delete), all bound to the card currently open, leaving only "Registrar pago" on the screen itself.
- Any portfolio card can be starred to revisit it later. Marks are stored only on the device, never sent to the server, and are removed on logout and when another branch's cache is purged. Tapping a bookmark only returns the pointer to that card in the cartera; opening its payments still requires a deliberate tap on the card, because the pointer is armed only by tapping the card itself (arrows and bookmarks leave it disarmed).
- The payments screen lists each movement as abono, resta, formatted date/time, description and state. `createdAt` arrives as epoch milliseconds (GraphQL's String coercion of a MySQL `DATETIME`), so the UI parses that, plain SQL datetimes and ISO instants before formatting; amounts use Colombian grouping. "Resta" is not sent by the server and is not stored in `tbl_descripcion`: it is rebuilt on the device from the card's current balance by undoing each newer movement, and the screen says so. A locally created payment is stamped with the device clock so it sorts and displays before the server confirms it.
- Editing or deleting a payment is only offered while it is still `created`; settled or handed-over movements show "Ya liquidado · no se puede editar ni eliminar" instead of dead buttons. "Eliminar crédito" is likewise disabled unless the card itself is still `created`. The server enforces the same rule for both `UPDATE_PAYMENT` and `DELETE_PAYMENT`, matching the legacy PHP, which already deleted only `str_estado='created'` rows.
- Switching the selected branch clears the previous branch's cached customers, cards, payments, and cursor. Still-pending operations stay bound to their original branch until acknowledged or deliberately discarded.
- Background synchronization can be turned off. The sync screen holds the on/off switch, the interval field (disabled while off), a pending-operations counter, and a "Sincronizar ahora" button that pushes the queue and then pulls server changes on demand. With the switch off no periodic work is scheduled, not even after choosing a branch; the button and the per-save push still run.
- Saving a payment returns to the card immediately instead of waiting for the server to confirm, because collectors work on the street. The movement is written to the local queue and shown with its pending marker; the queue counter and the conflict/rejection screens remain the only place a server refusal surfaces.
- Any open card offers "Crear otra tarjeta a este cliente", on the card screen and in the overflow menu, gated by the same `nueva tarjeta` permission as the legacy `views/cartera.html` button. The customer, the branch receipt sequence, and the next receipt number are preloaded; the number increments the last one while keeping its zero padding, exactly like `ajax/CarteraAjax.php`. Position is chosen with Primera/Antes/Después/Última chips (the midpoint between neighbours, with ±1.1 jumps at the edges) instead of typing a raw item number, concepto and modo are chips, and utilidad is computed as valor − costo and never typed, matching `dist/scripts/NuevoCredito.js`. The branch receipt sequences are cached in Room (`receipt_sequences`, schema v9) so the form still works offline after one online sync.
- Room is encrypted with SQLCipher. A random database key and the current session/token are AES-GCM encrypted under an Android Keystore AES key; wrapped material and session data are in `noBackupFilesDir`. Android cloud/device backup is disabled for app data.
- Offline changes are durable, account/company/branch-bound queue records with a UUID operation ID. Existing-record edits carry the stored change cursor as `baseVersion` (or an explicitly entered cursor if no local version is known). Customer references are server-assigned integer IDs. Credit IDs are opaque varchar IDs; create-credit sends an app-generated ID that the backend validates and persists exactly.
- `PENDING` and `IN_FLIGHT` remain visibly pending. A record becomes `CONFIRMED` only after the server returns a matching operation ID and an applied/confirmed acknowledgement. Transient network/server errors retry with WorkManager backoff when connected. The same UUID is reused on every attempt.
- Authentication expiration pauses the account queue until a successful online re-authentication. Permission rejection, conflicts, and rejected operations pause automatic sync. A conflict displays the returned server entity (only whitelisted observed fields are retained) and requires the user to deliberately discard the local draft before processing resumes. If the server omits its entity, the app says so and clears the optimistic cached record when the user explicitly discards. Rejected drafts also need an explicit discard. The backend's response and validation are authoritative.
- Logging out removes the account's cached records and queued operations. If unresolved operations exist, the app requires a separate discard confirmation first. Reinstalling the app also removes the device-local key and cache, so unsynced operations are unrecoverable; the UI warns about this.

This stage excludes cash close/reconciliation, expenses, and collector dispatch; those remain in PHP.

## Operation form and payload coverage

All exposed queue operations use typed fields and strict backend key names from `src/services/validation.ts`; payloads do not include `companyId` or `branchId`, which are bound by the authenticated operation input:

- Customer create/update sends `nombres`, `apellidos`, `sexo`, `fechaNacimiento`, `tipoDocumento`, `numeroDocumento`, `telefono`, `email`, `ocupacion`, `notaPersona`, `departamento`, `ciudad`, `barrio`, `calle`, `maxCredito`, `apodo`, `notaCliente`, `estadoCliente`, and `fiadorPersonaId`. Edits require an integer server customer ID. A locally created customer cannot be edited or referenced by a credit until its create operation is acknowledged, because `idcliente` is an integer and the server allocates it.
- Credit create sends `idtarjeta` matching `entityId` (opaque varchar, not an integer), integer `idcliente`, `idventa`, `concepto`, `valor`, `modo`, `plazo`, `prestamo`, `descripcion`, `cuotaInicial`, `item`, `utilidad`, `adicionalNumero`, `adicionalValor`, `tipoComprobante`, `serie`, `numero`, `nota`, `obligacion`, and `detalleDocumentoSucursalId`. It does **not** send a route ID; the backend chooses the open route. The branch document-sequence ID comes from the cached `receiptSequences` query; the form refuses to save without it. Credit update, terms, status, and reorder use their exact backend keys.
- Payment create uses the credit's opaque ID as mutation `entityId`; a generated `iddescripcion` identifies the new payment in the strict payload. The user enters a positive amount and the mapper sends a negative `abono`, matching the PHP/backend balance convention. Payment update also sends a negative `abono` and `descripcion`; delete has an empty object payload.
- Credit/payment delete and comment delete show a separate confirmation before queueing.
- Discount sends a negative `amount` (the legacy PHP form negates discount input); interest sends a positive amount plus integer `plazo`. Both accept optional `descripcion`.
- Comment create/update/delete use typed forms with `idcliente`/`comentario`/`tipo` and the strict update/delete payloads. Alert upsert takes icon, color, subject, and alert text and packs them as `icon/,color/,subject/,message`, matching `SaveOrupdateAlerta`; subject/body `/,` delimiters are stripped like the PHP source. Existing comment/alert IDs and a base cursor can be entered where needed.

Forms perform type, range, length, mode, and required-field checks for the payload contract. Permissions, open-route/document-sequence availability, balance, duplicate records, authorship, and all business rules remain server-authoritative. Permission rejections are stored as `REJECTED`, shown with the server message, and stop automatic retry. Conflicts retain a whitelisted server-current record when returned and require deliberate discard/resolution before the queue resumes.

The credit create form requires a customer ID already assigned by the server; it does not queue a credit against a temporary customer ID. Route selection is omitted because the backend assigns the current open route. Route discovery and document-sequence discovery/picking (the sequence ID is currently entered by the user) remain usability follow-up work. Existing comments/alerts are not independently listed by the app, so users must provide an ID to update/delete an existing record; the server validates ownership and scope.

`UPDATE_DOCUMENT` is not offered as a separate operation; document type/number are included in the typed full customer edit form. Cash close/reconciliation, expenses, and collector dispatch remain in PHP and are not exposed in Android.

Logging out while unresolved queue operations exist presents an explicit discard confirmation before deleting that account's local cache. The device unlock prompt is local-only and does not authenticate to the server.
