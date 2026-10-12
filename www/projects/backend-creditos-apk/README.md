# Android Credit API

TypeScript API for the Android credit workflow. It uses Express, `graphql-http`,
GraphQL, Zod, and MariaDB through `mysql2`. It reads and writes only the existing
legacy tables described below, plus the two tables in the optional offline-sync
migration.

## Run and configure

For a staged deployment on cPanel against an **isolated test database**, follow
the [Spanish migration and deployment checklist](DESPLIEGUE_CPANEL_PRUEBAS.md)
before starting the API.

Node.js 20 or newer is required. In the development container:

```sh
cd /var/www/html/projects/backend-creditos-apk
cp .env.example .env
# Replace every placeholder using your deployment's secret/configuration store.
npm install
npm run dev
```

The service listens on `PORT` (default `3000`), serves GraphQL at `/graphql`, and
has a non-database `/health` endpoint. For production, run `npm run build` then
`npm start`. `npm run typecheck` checks the strict TypeScript project. Database
and JWT configuration is environment-only:

| Variable | Meaning |
| --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MariaDB connection; all but port are required. Use a dedicated, least-privilege account. |
| `DB_POOL_SIZE` | Connection-pool limit (default 10). |
| `JWT_SECRET` | Signing secret; required and at least 32 characters. |
| `PORT`, `NODE_ENV` | HTTP listen port and environment. Set `NODE_ENV=production` in deployment; GraphQL requests require HTTPS unless running in `development` or `test`. |
| `TRUST_PROXY` | Optional Express trusted-proxy setting (for example, a specific proxy IP/CIDR); configure it only for the actual TLS-terminating proxy. |
| `FILES_ROOT` | Optional private directory for uploaded customer photos. Required only when a photo is supplied. |
| `APP_TIME_ZONE` | Optional IANA business zone (default `America/Bogota`, the zone webgoez PHP pins). Defines "today" for WhatsApp receipt resends; an invalid value fails those operations with `CONFIGURATION_ERROR`. |
| `PUBLIC_RECEIPT_ORIGIN` | Required to issue public receipt links. Set only the externally reachable origin (scheme, host, optional port), without path/query. Production requires HTTPS; development can use the computer's Wi-Fi IP and API port. |

`.env.example` contains placeholders, not deployment credentials. Do not commit a
real `.env`. The service does not print passwords, request bodies, URL query strings, JWTs,
or DB configuration. Send login as a GraphQL POST and do not put credentials
in URLs or proxy logs. Do not expose the HTTP listener directly: terminate TLS at a
trusted reverse proxy, configure `TRUST_PROXY` for that proxy, restrict
proxy-to-service access, set `NODE_ENV=production`, and require **HTTPS from
every Android client**. `/health` is intentionally available to internal HTTP
health checks and returns no sensitive data.

### Legacy password caveat

The legacy `tbl_usuario.str_password` column contains a fixed 32-character MD5
digest. Login computes MD5 over the supplied password in memory and compares
that exact digest; the cleartext is neither stored nor logged. This compatibility
path inherits MD5's serious weaknesses (fast offline guessing and collision
resistance). It is not a modern password-storage scheme. Plan a separately
approved password-hash migration; do not treat this API compatibility layer as
making existing credentials safe. TLS is mandatory in deployment.

JWTs are signed using `JWT_SECRET`, issued for the Android audience, and expire
at the next midnight in the server's local time zone. Configure the production
server's time zone to the business time zone. There is no refresh-token endpoint
in this stage. Each
authenticated GraphQL request reloads the user/company identity and current
named permissions from MariaDB; branch access is checked again for each
branch-scoped resolver. The token never supplies branch permissions. Login and
every authenticated request also check `tbl_descripcion_global` for the company's
current (`str_estado = 'actual'`) payment record. As in the PHP cartera, access
is denied after `date_corte` plus `int_dias_extras` days; no current record means
no payment restriction. The API returns `PAYMENT_REQUIRED` (HTTP 403 for
authenticated requests) and includes `paymentExpiresAt` (epoch milliseconds or
null) at login so the phone can block cached/offline access at the same cutoff.
The database and app clocks and time zones must be synchronized.

## GraphQL contract

All names below are stable client-facing names. For authenticated operations,
include the bearer token in the Authorization header.

```graphql
mutation Login($companyId: Int!, $username: String!, $password: String!) {
  login(companyId: $companyId, username: $username, password: $password) {
    token expiresIn paymentExpiresAt
    user { userId companyId employeeId username firstName lastName companyName }
    company { id name }
    branches { id name type extraCharge }
  }
}

query Portfolio($branchId: Int!, $first: Int!, $after: String, $snapshotCursor: String) {
  portfolio(branchId: $branchId, first: $first, after: $after, snapshotCursor: $snapshotCursor) {
    nodes { id personId firstName lastName documentType documentNumber phone email
      maxCredit status credits { id concept value frequency term principal balance status }
      comments { id comment type userId createdAt } }
    snapshotCursor nextCursor hasNextPage
  }
}

mutation ApplyOffline($input: OfflineOperationInput!) {
  applyOfflineOperation(input: $input) {
    operationId status entityId eventCursor replayed data
  }
}
```

Queries:

* `me`
* `branches`
* `portfolio(branchId: Int!, first: Int, after: String, snapshotCursor: String)`
* `customerById(branchId: Int!, id: Int!)`
* `customerByDocument(branchId: Int!, documentType: String!, documentNumber: String!)`
* `paymentHistory(branchId: Int!, creditId: ID!)`
* `receiptSequences(branchId: Int!)` — branch `Comprobante` counters (`id`, `series`, `lastNumber`, `documentType`) that feed the new-card form, mirroring `Cartera::GetTipoDocSerieNum`
* `receiptLinks(branchId: Int!, afterId: ID)` — up to 50 unexpired/unrevoked link summaries for the authorized branch; `hasMore` and the last summary's `id` paginate older links. It never returns bearer tokens or customer details and remains available after payment expiry for revocation.
* `bankAccounts(branchId: Int!)` — active `tbl_banco` accounts of the company **authorized in that branch** (`tbl_banco_sucursal`): `id`, `name`, `type`, `number`, `holderName`, `holderDocument` (NIT/CC of the holder), ordered by `int_orden`, offered as payment methods besides cash
* `openRouteCash(branchId: Int!)` — `routeId`, `base`, `otherIncome` and `expenses` (positive) of the branch's open, not yet saved `tbl_detalle_ruta`, summed from `tbl_contabilidad_detalle`: `base` rows, `entrada-*` except `recaudo`/`diferencia`, and `salida-*` except tipo 4 (prestamos/articulos); used by the APK pocket-cash line
* `routeSettlement(branchId: Int!)` — end-of-day accounting of the branch's open route (see *Route settlement* below)
* `routeEntries(branchId: Int!)` — the route expenses and bases written today
* `routeExpenseCatalog(branchId: Int!)` — expense categories, concepts and payrolls the branch may use
* `syncChanges(branchId: Int!, after: String!, first: Int)`

Mutations:

* `login(companyId: Int!, username: String!, password: String!): AuthPayload!`
* `startBiometricRegistration(deviceId: String!): BiometricChallenge!` — authenticated setup; returns a short-lived challenge to sign locally with Android biometrics
* `finishBiometricRegistration(deviceId: String!, challengeId: ID!, publicKeySpki: String!, signature: String!): BiometricRegistrationResult!` — stores/updates the device public key for that user
* `startBiometricLogin(companyId: Int!, username: String!, deviceId: String!): BiometricChallenge!` — returns a login challenge only when that account already has an active credential on that device
* `biometricLogin(companyId: Int!, username: String!, deviceId: String!, challengeId: ID!, signature: String!): AuthPayload!` — verifies the challenge signature and issues the same auth payload as password login
* `applyOfflineOperation(input: OfflineOperationInput!): OfflineOperationResult!`
* `issueReceiptLink(branchId: Int!, customerId: Int!, kind: String!, recordId: ID!, format: String!): ReceiptLink!` — creates an immutable eligible credit/payment snapshot; `format` is `ticket`, `factura`, or `cartulina`, and the result contains `id`, `url`, `expiresAt`.
* `revokeReceiptLink(branchId: Int!, id: ID!): Boolean!` — revokes one link in the authorized branch; allowed after company payment expiry.
* `settleRoute(branchId: Int!, cash: Float!, coins: Float!, difference: Float!): RouteSettlement!` — hands the route over (see *Route settlement* below)

`OfflineOperationInput` contains `operationId` (UUID), `branchId`, `kind`,
`entityId`, `baseVersion` (decimal event-cursor string or null), and a JSON
`payload`. `kind` supports:

`CREATE_CUSTOMER`, `UPDATE_CUSTOMER`, `UPDATE_DOCUMENT`, `CREATE_CREDIT`,
`UPDATE_CREDIT`, `UPDATE_CREDIT_TERMS`, `CREATE_PAYMENT`, `UPDATE_PAYMENT`,
`DELETE_PAYMENT`, `DELETE_CREDIT`, `APPLY_DISCOUNT`, `ADD_INTEREST`,
`CHANGE_CREDIT_STATUS`, `REORDER_CREDIT`, `CREATE_COMMENT`, `UPDATE_COMMENT`,
`DELETE_COMMENT`, `UPSERT_ALERT`, `CREATE_EXPENSE`, `UPDATE_EXPENSE`,
`DELETE_EXPENSE`, `CREATE_BASE`, `UPDATE_BASE`, `DELETE_BASE`.

The branch list includes `extraCharge` from `tbl_sucursal.str_cobro_adicional`
(`seguro`, `boleta`, `ninguno`) for the Android new-card form. A `CREATE_CREDIT`
may provide `tarjetaReferenciaId` and `ubicacion` (`antes`/`despues`). In that
case the backend locks the branch's cards and recalculates `float_item` beside
the referenced card rather than trusting a possibly stale offline `item`. When
legacy duplicates or FLOAT precision prevent an insertion between neighboring
positions, it renumbers the branch in its current `float_item,idtarjeta` order
within the transaction; the existing card-update triggers emit events for the moved cards.
When a new card exceeds the customer's available cupo, the service follows
`Cartera::Registrar`: an active customer can have `dec_max_credito` raised to
the existing total debt plus the card's `dec_prestamo`, within the same
transaction as card creation. This requires Super Administrador, administrator
of the branch's office, or an active branch permission `editar cliente` /
`editar maximo del credito`. An employee other than Super Administrador cannot
approve a new or increased client limit above their own
`tbl_empleado.dec_max_credito`, including an automatic increase during card
creation. The server verifies this at synchronization time. `login` and `me`
provide the employee's maximum and administrator status for UI guidance;
`personDocumentTypes` and `customerCandidate` support online identification
before registering a client, including reuse of an existing person without
duplicating their document. Otherwise the operation is rejected in Spanish;
the PHP rule for inactive customers remains in force. The card's actual
starting debt is still `dec_valor` (minus any initial payment), not its cost.

`ADD_INTEREST` reads the locked card before updating its balance and changing it
to `refinanciada`; cards in `created` or `entregando` are rejected without
writing the interest or changing their state. The same restriction applies to
the PHP cartera interest action.
Legacy requests without the reference still use `item`. The receipt sequence
counter is also locked and incremented on the server; a number shown on the
device before synchronization is only provisional.

Strict per-kind payload schemas accept only observed business fields. Customer
payload field names are `nombres`, `apellidos`, `sexo`, `fechaNacimiento`,
`tipoDocumento`, `numeroDocumento`, `telefono`, `email`, `ocupacion`,
`notaPersona`, `departamento`, `ciudad`, `barrio`, `calle`, optional
`fotoBase64`, `maxCredito`, `apodo`, `notaCliente`, `estadoCliente`, and optional
`fiadorPersonaId`. Credit frequency values are the source-system Spanish
strings: `Diario`, `Semanal`, `Quincenal`, `Mensual`. Credit creation requires
the scoped `detalleDocumentoSucursalId` receipt-sequence row. The legacy `tbl_descripcion.dec_abono` convention stores balance-reducing
payments as negative adjustments. `CREATE_PAYMENT` and `UPDATE_PAYMENT` accept
that sign in `abono`; amount and resulting balance are checked against locked
same-branch credit/payment rows inside the transaction. `UPDATE_PAYMENT` and
`DELETE_PAYMENT` only accept movements still in `str_estado='created'`, the rule
the legacy PHP already applied to deletions.

Payload fields by kind (all undeclared fields are rejected):

| Kind | Payload fields |
| --- | --- |
| `CREATE_CUSTOMER`, `UPDATE_CUSTOMER` | Customer fields above; `fechaNacimiento`, `fotoBase64`, and `fiadorPersonaId` may be omitted. |
| `UPDATE_DOCUMENT` | `tipoDocumento`, `numeroDocumento` |
| `CREATE_CREDIT` | `idtarjeta`, `idcliente`, `concepto`, `valor`, `modo`, `plazo`, `prestamo`, `descripcion`, `item`, `utilidad`, `adicionalNumero`, `adicionalValor`, `tipoComprobante`, `serie`, `numero`, `nota`, `detalleDocumentoSucursalId`; optional `idventa`, `cuotaInicial`, `cuotaInicialId`, `bancosInicial` (cuenta receptora de la inicial), `obligacion`, `bancos` (cuenta de origen del crédito) |
| `UPDATE_CREDIT` | `concepto`, `valor`, `modo`, `plazo`, `prestamo`, `descripcion`, `item`, `utilidad`, `adicionalNumero`, `adicionalValor`, `tipoComprobante`, `serie`, `numero`, `nota` |
| `UPDATE_CREDIT_TERMS` | `modo`, `plazo`, `numero`, `createdAt` |
| `CREATE_PAYMENT` | `iddescripcion`, negative `abono`; optional `descripcion`, `bancos`, `vuelto` |
| `UPDATE_PAYMENT` | negative `abono`, `descripcion`; optional `bancos`, `vuelto` |
| `DELETE_PAYMENT`, `DELETE_CREDIT`, `DELETE_COMMENT` | `{}` |
| `APPLY_DISCOUNT` | `amount`; optional `descripcion` |
| `ADD_INTEREST` | `amount`, `plazo`; optional `descripcion` |
| `CHANGE_CREDIT_STATUS` | `status` (`moroso`, `fallecio`, or `discapacitado`; reserved and other unsupported values are rejected) |
| `REORDER_CREDIT` | `item` |
| `CREATE_COMMENT` | `idcliente`, `comentario`, `tipo` |
| `UPDATE_COMMENT` | `comentario` |
| `UPSERT_ALERT` | `idcliente`, `icon`, `color`, `subject`, `text` |

`UPDATE_CUSTOMER` and `UPDATE_DOCUMENT` use the customer ID in `entityId`;
credit/payment/comment IDs retain the legacy varchar IDs and are scoped to the
authenticated company and branch by the server. `CREATE_CREDIT.entityId` must
equal `payload.idtarjeta`; for `CREATE_PAYMENT`, `entityId` is its parent credit
ID. Existing-record mutations require a non-null decimal-string `baseVersion`;
new customer, credit, and regular comment records can omit it. `UPSERT_ALERT`
always requires it (`"0"` for an initial alert). Monetary payloads are
finite numbers, and text limits follow the observed legacy column sizes.

Errors use GraphQL `extensions.code`: `UNAUTHENTICATED`, `FORBIDDEN`,
`NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT`, `IDEMPOTENCY_MISMATCH`,
`BUSINESS_RULE`, `CONFIGURATION_ERROR`, and `INTERNAL_SERVER_ERROR`. A stale
mutation returns `CONFLICT` and `currentRecord` with the current authoritative
record; reconcile locally and submit a new operation against the refreshed
cursor. Do not blindly retry with an old base version.

## Scope and authorization

Company administration is recognized only by the exact database value
`tbl_empleado.str_cargo = 'Super Administrador'`; it grants access only to
branches with that authenticated `idglobal`. The employee listed as
`tbl_oficina.idempleado_administrador` can access and modify branches in that
office without a `tbl_auth_sucursal` row or named grants. Other employees need
an active branch/company grant; their named permissions are reloaded through
`tbl_auth_sucursal` → `tbl_auths` → `tbl_auth`. Writes also require a valid
open route and either a dispatched employee, this office administrator, or
the Super Administrador. Never send employee, user, tenant, or permission IDs
as authoritative values.

Phone-only `ADD_CUSTOMER_PHONE`, `SELECT_CUSTOMER_PHONE` and `RECORD_WHATSAPP_OPEN` are explicit permission exceptions: authenticated branch access and customer/company scope remain mandatory, but `editar cliente` is not required. Full customer/document editing retains that permission. Apply migrations 007 then **008_whatsapp_open_usage.sql** manually before deploying this API/APK. 008 adds shared per-company/person/normalized-phone opening counts and timestamps without altering phone history or primary selection. Counts are serialized as strings to preserve BIGINT precision.

Receipt recipient selection suggests the most frequently **opened** saved valid number across all collectors, breaking ties by primary then stable history order; it never changes the primary. Android queues an additive, transactionally idempotent opening operation only after the external intent succeeds. Opening events synchronize to other authorized branches but do not invalidate customer edit base versions. External WhatsApp/browser intents cannot confirm sending or delivery; contact-picker openings are not attributed to a number. Offline counters include persisted pending increments until synchronization. See [Android guide](android/GUIA_USO_APK.md) and [deployment guide](DESPLIEGUE_CPANEL_PRUEBAS.md) for limitations and local-only fixture verification.

The API enforces `crear cliente`, `editar cliente`, `nueva tarjeta`,
`editar cuota`, `eliminar cuota`, `eliminar credito`, `descuento`,
`cobrar intereser`, `pasar a morosos`, `pasar a retirados`, and `ordenar` as
appropriate to each operation (`moroso` uses the first status permission;
`fallecio` and `discapacitado` use the retired-status permission). Other
unsupported status values and reserved legacy values are rejected. The API
also enforces tenant-scoped document/email
uniqueness, same-company related-person and sale IDs, open-route requirements,
credit limits, receipt-sequence ownership, duplicate discount/interest
prevention, and same-branch payment/credit scope. Payment balance is computed
from locked authoritative rows inside the transaction. Deletes are allowed
only for records in `created` state, and payment edits are restricted the same
way: once a payment leaves `created` it belongs to a closed route. Comments can
be updated/deleted only by their creating user.

These checks deliberately close server-side authorization gaps in legacy PHP
flows. Cash closing, accounting, dispatch, and other non-mobile workflows are
out of scope. The API does not modify PHP files.

Customer photos are optional base64 data URLs for JPEG/JPG or PNG. Decoded size
is limited to 10 MiB; bytes are signature-checked. The server writes a random
filename under `FILES_ROOT` and stores only that name in `tbl_persona.str_foto`.
Client paths and filenames are ignored. Keep `FILES_ROOT` private and outside
executable/public web roots; back it up and serve photos only through a future
separately authorized endpoint.

`portfolio`, `customerById`, and `customerByDocument` include linked legacy
comments/alerts with their type and creating user; only the creator can edit or
delete their comment. `UPSERT_ALERT` uses `tbl_comentarios` +
`tbl_comentarios_cliente` with
`str_tipo='alerta'`, associating the alert with the authenticated user and the
payload customer. It creates only that user's alert and never accepts a
payload user ID. The source PHP flow creates an alert only when none exists;
an attempt to submit another alert for the same customer and user returns
`CONFLICT` and never changes the existing text. The stored representation is
`icon/,color/,subject/,text`; the `/,` separator is removed from subject and
text before storage, matching PHP behavior. The combined value must fit the
legacy 255-character column.

## Route settlement

`routeSettlement(branchId)` and `settleRoute(...)` (`src/services/settlement.ts`)
replace the legacy `RecibeCuentas::RegistrarContabilidadDetalle` +
`RecibirCuentasAjax` pair for the APK's *Cuentas del día* screen. The query
returns the open (`str_estado='created'`) `tbl_detalle_ruta` of the branch, its
`canSettle` flag, the day's totals and an ordered `movements` list (label,
amount, `countsForCash`) so a non-technical user can read what happened.

Totals and the expected cash follow the legacy formula:

```
expectedCash = base
             + (collected - collectedBank)
             + otherCollected
             - (credits - creditsBank)
             - expenses
difference   = (cash + coins) - expectedCash
```

The `*Bank` terms are the improvement over the web totalizar, which still counts
bank transfers as if they were cash. Only payments whose description starts with
`Abono`, `Inicial` or `Cancelado` count as collected; `Intereses` and
`Descuento` move debt, not money, so they appear with `countsForCash = false`.
Following the branch-office convention, only route expenses
(`salida-totalizar%`) are subtracted; contabilidad entries (tipo 9) and
`salida-contabilidad` rows are listed but not counted, so the numbers match the
office. The pocket-cash line does count them and may therefore differ.

`settleRoute` requires `str_estado='created'`, recomputes the difference and
rejects the call when it does not match the one sent. It writes or updates the
named rows `efectivo` and `efectivoMonedas` (tipo 8, `info-totalizar`) plus
`diferencia` (tipo 7, `entrada-totalizar`), then moves
every `created` row of `tbl_descripcion`, `tbl_tarjetas`,
`tbl_contabilidad_detalle` and `tbl_detalle_ruta` of that branch to
`entregando`. Permission mirrors the web: Super Administrador, the office
administrator, or the `bloquear` permission on the branch.

### Route expenses and bases

The base is no longer typed while handing in the accounts: it is written during
the day like any other movement, one or several times, and the settlement screen
only shows the sum. `routeEntries(branchId)` lists today's `base` and
`salida-totalizar` rows of `tbl_contabilidad_detalle`, and
`routeExpenseCatalog(branchId)` publishes the categories the branch may use
(`tbl_tipo_contabilidad` of the company plus the shared `idglobal = 1001`,
`str_operacion='salida'`), their concepts (`tbl_de_contabilidad`) and the open
payrolls (`tbl_nomina`).

Payroll selection and server-side writes use the same scope: a dispatched
employee can select only their own active payroll on that route; the Super
Administrador can select any active payroll in their company; an office
administrator can select active payrolls of employees assigned to the branch's
office, even if those employees are not dispatched. Salary expenses (category
`2`, matching webgoez) require a payroll. Every write still requires an open
route. The API rechecks authorization when offline expenses are synchronized.

The six offline kinds `CREATE/UPDATE/DELETE_EXPENSE` and
`CREATE/UPDATE/DELETE_BASE` write those rows. An expense payload carries
`idtipo_contabilidad`, `nombre`, `valor`, optional `detalle` and optional
`idnomina` (linked through `tbl_detalle_nomina`); a base payload only carries
`valor` and optional `detalle`. The id of a new row travels as `entityId`, the
way webgoez generates it with `uniqid()`. **The amount always travels positive**
and the server applies the sign webgoez stores (negative for an expense), so a
queued operation can never flip the cuadre. The pair (category, concept) must
exist in the catalog, and editing or deleting is only allowed while the row is
still `created`. Unlike the web, the APK can correct a row instead of deleting
and rewriting it.

Those rows also travel through `syncChanges` as `recordType: "accounting"`, so a
gasto or a base written by another collector reaches the phone on its own. The
change carries the amount with the sign the database keeps, `operation`, `state`
and the name of whoever wrote it; the client keeps only the `created` rows whose
name is `base` or whose operation starts with `salida-totalizar`, because the
same table also holds the counted cash and the difference of the settlement.

Route-day writes now carry `OfflineOperationInput.routeId`: the `iddetalleruta`
the phone knew as open (`str_estado='created'`) when the record was queued.
Only route-day kinds (payments, credit create/delete, discount/interest,
expenses and bases) are allowed to queue when that local open route exists. On
arrival, the backend revalidates that exact route ID in that branch and refuses
the record in one of two ways:

- `ROUTE_REOPENABLE` when the route is now `entregando` (or when a different
  route is the open one). The office can unlock that day back to `created` from
  the web (`manejarDesbEditarDetalleRuta`), so the very same record can be sent
  again later.
- `ROUTE_CLOSED` when the route is `saved` or no longer exists. That record can
  never be applied.

The APK never sweeps the queue on its own: the record stays in **Cola** marked
`REJECTED` with its code, sync pauses with reason `ROUTE`, and the person
decides — resend (only for `ROUTE_REOPENABLE`) or remove from the queue, one by
one or all at once. Whatever is removed is written to **Logs** first so nothing
is lost silently.

The web was aligned with this: `RecibeCuentas::RegistrarContabilidadDetalle` no
longer writes the `base` row (it read the form field and overwrote *every* base
of the day) and takes the stored sum from `view_contabilidad_detalle_ruta`
instead; the field in `formContabilidadDetalleRuta.html` is now read-only.

## Payment methods migration

`migrations/003_payment_methods.sql` improves the unused `tbl_banco` (adds
`idglobal`, `str_estado` default `'activo'`, `int_orden`, timestamps and index
`ix_banco_global_estado`) and creates two link tables: `tbl_descripcion_pago`
(abono ↔ bank) and `tbl_tarjeta_pago` (credit/article paid out ↔ bank). An abono
or credit **without rows is 100 % cash**, so `tbl_descripcion`/`tbl_tarjetas`
are untouched and historical data stays valid; several rows allow mixed
payments. It is re-runnable and has a commented rollback. **Apply it before
deploying this API version**: payment and credit queries read the link tables.

`CREATE_PAYMENT`, `UPDATE_PAYMENT` and `CREATE_CREDIT` accept optional
`bancos: [{ idbanco, valor > 0, referencia? }]` (max 5, no repeated bank). The
server checks that each bank is active and belongs to the company and that the
sum does not exceed the abono (or the credit's `prestamo`). On `UPDATE_PAYMENT`,
sending `bancos` replaces the split; omitting it keeps it, and the update is
rejected if the kept split would exceed the new amount. Payments expose
`bankAmount` and credits `bankFunded` (sum of their bank rows).

When the customer transfers **more** than the abono, the collector hands the
difference back in cash. Abonos therefore accept `vuelto` (the excess, declared
on purpose): the server requires `vuelto === bank total − abono` when there is
an excess and rejects `vuelto` otherwise, so a mistyped transfer can never empty
the collector's pocket silently. Credits stay strict (no `vuelto`). The pocket
cash needs no extra column: `abonos − received by bank` simply turns negative by
exactly the cash returned.

`migrations/004_bank_holder_branches.sql` (apply after 003, before deploying)
adds the holder as registered at the bank (`str_titular`), the holder's NIT or
ID (`str_documento_titular`) and the owning office (`idoficina`, NULL =
company-level) to `tbl_banco`, plus `tbl_banco_sucursal`: the accounts each
sucursal (ruta) may use. The office administrator authorizes accounts for the
sucursales of their office in webgoez (`bancos_pago.php`). Both `bankAccounts`
and the `bancos` validation only accept accounts linked to the operation's
branch, so accounts existing before 004 must be authorized to be usable.

## Biometric credential migration

`migrations/005_biometric_credentials.sql` adds two additive tables:

* `mobile_biometric_credential` stores the active **public key** per
  `idglobal`/`idusuario`/`device_id`.
* `mobile_biometric_challenge` stores short-lived one-time challenges for
  enrollment/login (`str_purpose` = `ENROLL`/`LOGIN`), marked with `used_at`
  after successful verification.

The APK never sends raw biometrics. Android validates the biometric locally and
uses the Keystore private key to sign server challenges; the backend verifies
that signature with the stored public key and then issues the normal JWT.

## Payment author migration

`migrations/002_payment_author.sql` adds two NULLable columns to
`tbl_descripcion`: `idusuario` (who registered the abono) and `str_origen`
(`android`/`web`), plus index `ix_descripcion_usuario (idglobal, idusuario)`.
It is additive and re-runnable (`IF NOT EXISTS`, MariaDB >= 10.0.2); historical
rows stay NULL and are shown as "not recorded". **Apply it manually, after a
backup, to every database used by the API or PHP web app before deploying
either version**: the API writes the authenticated `userId` and `'android'`,
while PHP writes its authenticated session user and `'web'` on new payment
inserts. Neither can create payments without the new columns. The file contains
a commented rollback. On large tables the index build can take a few minutes.
Payment queries return the linked person's first and last names as
`createdByUsername` (falling back to the login name if no person name is
available), alongside `createdByUserId` for exact ownership checks in clients.

## Offline migration and synchronization

`migrations/001_offline_sync.sql` is an **additive MariaDB 10-compatible
proposal**. It creates `mobile_operation` (per-user/company idempotency receipts)
and `mobile_change_event` (monotonic auto-increment cursors), a single-row
transactional event-order lock, two ID-only scope views, and triggers on the
shared persona/client/credit/payment/comment/link/route/branch/branch-access/
receipt-sequence tables. It does not alter or drop legacy tables. Events contain
scoped IDs/actions rather than copied legacy row data; the migration does not
require MariaDB JSON functions. The event trigger locks one row until the
writing transaction commits, so a later event ID cannot commit ahead of an
earlier allocated ID.

**Nothing applies DDL automatically. Do not run this against production as part
of application startup or deployment.** Before a DBA considers it:

1. Take and verify a full backup of a disposable/staging clone.
2. Confirm that clone's exact MariaDB version supports the trigger/view syntax
   and that the view and trigger names do not collide with local objects. Install
   the tables first (including the lock table/seed row), then create views and
   triggers once; `CREATE TABLE IF NOT EXISTS` is repeatable, while
   `CREATE VIEW` and `CREATE TRIGGER` require checking a partial installation
   manually.
3. Review the trigger dependencies against the deployed schema, then apply the
   file manually to the clone only.
4. Verify existing row counts and data are unchanged, both new tables exist,
   all intended triggers are installed, and controlled insert/update/delete
   tests on the clone produce ordered events and tombstones.
5. Exercise API idempotency, rollback, permission, and conflict cases against
   that isolated test database. Back up production and schedule a separately
   reviewed manual rollout only after sign-off.

The API expects the migration tables and views to exist before offline-operation
or sync endpoints are used; startup does not check or install DDL. The SQL dump
reports MariaDB 10.11.14, but the live server version has not been
authenticated. This migration has **not** been applied or tested against the
live database (and this implementation did not connect to a database). Existing
rows are not backfilled with change events; conflict detection starts with
events captured after migration installation. Initial clients must fetch a
fresh snapshot before enabling offline writes.

`portfolio` captures `snapshotCursor` from the event table before paginating.
Keep that same cursor while requesting subsequent pages, using the returned
`nextCursor` as the customer-page `after` value. Then poll `syncChanges` from
the snapshot cursor; its cursor is a decimal string and is exclusive (`id >
after`). Continue from `syncChanges.nextCursor`, including through empty pages;
sync cursors are scoped per branch, and a cursor ahead of that branch's
high-water mark is rejected.
`hasNextPage` indicates that a further bounded page remains.
The sync resolver uses event IDs/actions to fetch the latest authoritative
record and returns it as `payload`; it never forwards raw trigger
`payload_json` or returns null for a legacy PHP update. If a row was physically
deleted or is no longer visible in the selected branch, the API returns
`{ id, deleted: true }` with `action: "DELETE"` instead. Repeated update events
may therefore contain the same latest state; process them in cursor order and
use the last state.

Customer events are fanned out to a branch only when that customer has a credit
there or has branch ownership established by its creating employee's active
company/branch association (or a branch-specific customer-create event written
by the API). The resolver rechecks this before returning customer PII and
rechecks visibility for linked comments. Comment events carry the affected
customer ID and resolve only that customer link. When a customer stops being
visible in a branch, the API returns a tombstone rather than company-wide record
data. Other record types are selected by authenticated company and branch;
branch-access events are not exposed through sync.

An offline operation receipt and its financial mutation commit in one database
transaction. Replaying the same UUID with exactly the same normalized request
returns the stored response; reusing that UUID with a different request returns
`IDEMPOTENCY_MISMATCH`. Only a SHA-256 request digest and response receipt are
stored in `mobile_operation`; raw customer payloads and image base64 are not
stored in that idempotency table. The unique owner/operation constraint
serializes concurrent retries; the transaction that wins commits the financial
write, event, and receipt together, and later identical requests return that
receipt. A request with a different hash fails. Deadlocks/timeouts roll back
and return a retryable conflict; retry with the same operation ID. Keep the UUID
stable across retries. A stale
`baseVersion` returns `CONFLICT`; fetch/reconcile the current record, then issue
a new operation ID and refreshed version. The API never silently overwrites a
newer event. Event cursors are monotonic within the shared event table and may
contain gaps.

## Tests

`npm test` builds TypeScript and runs DB-independent Node unit tests for the
legacy digest comparison, exact admin/branch scope logic, operation payload
idempotency/mismatch and conflict checks, strict payload rules, branch-scoped
sync materialization/tombstones, route settlement totals and handover, migration
additivity, and GraphQL schema validation. It does not connect to MariaDB.

The discoverable `test:integration` script runs the isolated integration test:

```sh
npm run test:integration
```

This command builds the API, then the test deliberately refuses to start unless
`RUN_DB_INTEGRATION=1` and explicit `TEST_DB_HOST`, `TEST_DB_NAME`,
`TEST_DB_USER`, and `TEST_DB_PASSWORD` are supplied. Without those variables it
exits before opening any connection. When deliberately configured for an
isolated test database, it overrides ordinary
`DB_*` values with those explicit test values, verifies the test schema, then
performs a concurrent duplicate-receipt insert/commit/delete check in
`mobile_operation`. That check writes only a random UUID row and removes it in
the explicitly configured test schema; it never falls back to the application
database. Use only an isolated test clone with the migration already reviewed/
applied; do not use production credentials.

Payroll scope checks for PHP and the API share 15 role/office/dispatch fixtures:

```sh
npm run build
RUN_PAYROLL_SCOPE_TESTS=1 node --test tests/payroll-scope.test.mjs
# From the sibling webgoez directory:
RUN_PAYROLL_SCOPE_TESTS=1 php tests/payroll-scope.php
```

Use a local test connection with `CREATE TEMPORARY TABLES` privileges. These
checks shadow all queried tables with connection-local temporary tables and
never write permanent application records; closing the connection removes
the fixtures. The PHP test uses the shared fixtures from the monorepo's backend
test directory. Android form/payload checks:
`./gradlew :app:testDebugUnitTest --tests com.backendcreditos.mobile.RouteEntriesScreenTest`.
# Corrección reversible de teléfonos

Aplicar manualmente `migrations/009_customer_phone_validity.sql` después de 001–008
antes de actualizar API/APK/PHP. La copia de despliegue PHP
`webgoez/sql/009_customer_phone_validity.sql` es idéntica; no se instala automáticamente.
009 es idempotente, conserva los triggers 007 y publica cambios para todas las
sucursales del cliente. Solo se aplica localmente durante estas pruebas.

En Android: cartera → menú del cliente → **Crear o seleccionar teléfono de WhatsApp**.
El historial permite **Marcar incorrecto** y **Restaurar**, con confirmación deliberada.
Cualquier usuario autenticado con acceso autorizado al cliente/sucursal puede corregirlo:
no exige `editar cliente`, creador ni administrador. No existen autores históricos
de teléfonos; `validityChangedBy/At` identifica la última corrección, no la creación.
`SET_CUSTOMER_PHONE_VALIDITY` recibe `{telefono: número normalizado, invalid: boolean}`.

Los INCORRECTOS permanecen visibles, pero se excluyen de selección del principal,
destinatarios de WhatsApp, respaldo del principal y nuevas aperturas/uso. Agregar el
mismo número no lo restaura. Para marcar el principal:
**«Selecciona primero otro teléfono principal»**. Si un formulario antiguo vuelve
a seleccionar un número incorrecto, la marca no se pierde y WhatsApp no lo usa.
Restaurar conserva los contadores anteriores; no borra historial ni auditoría.
La cola conserva los cambios optimistas tras snapshots y encadena correcciones
con altas/selecciones pendientes. Un conflicto o rechazo revierte la marca local.

# Reenvío de comprobantes por WhatsApp y contador oculto por registro

Aplicar manualmente `migrations/010_whatsapp_receipt_open.sql` después de 001–009
(idempotente; solo crea `mobile_whatsapp_receipt_open`, no altera tablas legadas).
Sin 010 la operación `RECORD_WHATSAPP_RECEIPT` falla; el resto de la API no cambia.
Solo se aplicó a la base local verificada `websdnco_db_webgoez`; no a producción.

En la APK: **Actividad → Cola**, en tarjetas `CREATE_CREDIT` (Préstamo/Artículo) y abonos
`CREATE_PAYMENT`/`UPDATE_PAYMENT` aparece **Reenviar comprobante por WhatsApp** (no en Liquidación).
Restricción real, aplicada por el servidor y repetida en la APK:

- la tarjeta (`tbl_tarjetas`) o abono (`tbl_descripcion`) existe, es de la empresa,
  sucursal y cliente indicados y su estado **actual** es `created` o `entregando`;
- fue **creado hoy** en `APP_TIME_ZONE` (por defecto America/Bogotá; `created_at` se lee con el
  reloj de MariaDB y se convierte a esa zona);
- un abono `Inicial` nunca se reenvía solo: su cuota va dentro del comprobante de la tarjeta.

Si no se cumple, el servidor responde `RECEIPT_NOT_ELIGIBLE` sin contar nada (sin respaldo ni
otro registro). La APK juzga los registros sin enviar con la caché y la hora de la cola; los
confirmados exigen conexión y se consultan en vivo (`customerById` + `paymentHistory`).

`RECORD_WHATSAPP_RECEIPT` (entityId = cliente; payload estricto
`{tipo: credit|payment, registroId, telefono?}`) se encola una sola vez por apertura externa
aceptada por Android y, en una transacción, suma **1** al contador oculto del registro y, si
se eligió un teléfono guardado válido, **1** al contador compartido de ese teléfono (por eso
no se encola además `RECORD_WHATSAPP_OPEN`). Recibo idempotente: reenviar la misma operación no
vuelve a contar. No requiere versión base, no está ligada a la ruta, no exige permisos
adicionales (acceso a sucursal + cliente) y no cambia principal, validez ni historial de
teléfonos. Un rechazo `RECEIPT_NOT_ELIGIBLE` queda en Cola, revierte el +1 local del teléfono
y **no pausa** la sincronización. Si la tarjeta/abono aún no se envió, la apertura depende de
esa operación.

Limitaciones del contador (`open_count`, `first/last_opened_at`, `last_opened_by`): cuenta
aperturas exitosas del enlace externo (WhatsApp o navegador), **no** mensajes enviados ni
entregados; WhatsApp no informa al servidor. Elegir contacto dentro de WhatsApp cuenta el
registro pero ningún teléfono. Una apertura de un cliente creado sin conexión y aún no
sincronizado no se puede contar. El contador no se expone por GraphQL ni en ninguna pantalla;
solo se consulta en la base de datos.

Comprobante de Artículo: incluye descripción, valor, plazo, cuota aproximada (valor ÷ plazo),
**cuota inicial** (parte por transferencia si hubo bancos) y saldo = valor − inicial, todo en el
mismo mensaje. La inicial sale de la fila `Inicial` cacheada/consultada o, sin ella, del payload
`cuotaInicial`/`bancosInicial`. No incluye otros abonos del día. El costo interno (`dec_prestamo`)
no se envía al cliente.

Pruebas: `npm test` (`tests/unit/receipts.test.mjs`) y, solo contra una base local verificada con
010 aplicada, `node tests/whatsapp-receipt.local.mjs <hostname-del-contenedor-mariadb>`: crea datos
de prueba en la empresa -2000000010, comprueba elegibilidad/reintentos y los borra.

## Enlaces públicos de comprobantes de WhatsApp

Aplicar manualmente `migrations/011_whatsapp_receipt_links.sql` después de 001–010. Es aditiva,
re-ejecutable y crea solo `mobile_whatsapp_receipt_link`; **no se aplicó a producción**. La tabla
guarda un hash SHA-256 de un token aleatorio de 256 bits y un snapshot JSON versionado e inmutable;
nunca almacena la URL/token en claro ni una imagen. `issueReceiptLink` exige sesión, acceso a la
sucursal, pertenencia real del cliente y registro existente elegible (`created`/`entregando` y
creado hoy en `APP_TIME_ZONE`). Un registro sin sincronizar no recibe un enlace falso.

La APK conserva el texto editable, permite elegir **Ticket, Factura o Cartulina** (sugiere el tipo
que ya tiene la tarjeta) y añade el enlace antes de abrir el selector habitual de WhatsApp. Si el
registro no se puede emitir en línea, ofrece **Enviar solo texto** o esperar a que sincronice. Una
persona que posea el enlace puede ver/descargar el comprobante hasta que venza a los 30 días o un
usuario autorizado de esa sucursal lo revoque mediante `revokeReceiptLink`; la revocación sigue
disponible desde **Configuración → Administrar enlaces compartidos**, incluso después de enviar el
mensaje o aunque haya vencido el pago de la cuenta. Tratar el enlace como información
confidencial: funciona como una autorización bearer, no pide inicio de sesión, y puede reenviarse.

El HTML público y la imagen PNG incluyen solo la mínima información necesaria (empresa/sucursal,
cliente, tipo/número/fecha, concepto/descripción/valor/plazo y, cuando corresponde, cuota inicial
con su distribución banco/efectivo, importe del abono y saldo **al emitir**). No exponen documento,
teléfono, dirección, usuario interno ni `dec_prestamo`. La cuota inicial de un Artículo va dentro
del mismo snapshot de tarjeta; los abonos posteriores son comprobantes separados. No se reconstruye
un saldo histórico: se etiqueta el saldo autoritativo leído en el instante de emisión. El documento
es un comprobante interno, **no una factura electrónica**.

`GET /comprobante/:token` sirve una vista mínima sin recursos de terceros y
`GET /comprobante/:token/imagen` genera y transmite PNG en memoria al descargarlo; no persiste
archivos. Ambas respuestas son privadas/no-cache, no permiten referer y tienen CSP; se limitan a
60 solicitudes por IP por minuto. Los logs de Express omiten la ruta pública para no registrar el
token. Configura también el proxy para **no guardar el path** de `/comprobante/` en logs de acceso.

Configura `PUBLIC_RECEIPT_ORIGIN` con un origen alcanzable por el teléfono. En desarrollo local,
por ejemplo, `http://192.168.1.22:3000` solo funciona en la misma Wi-Fi y requiere permitir el
puerto del API en el cortafuegos; sustituye la IP por la dirección LAN actual del computador.
`NODE_ENV=production` exige un origen HTTPS y los clientes Android de producción también requieren
HTTPS. La validación ignora `Host` recibido y rechaza rutas, credenciales y parámetros dentro del
origen. Respalda la base y verifica host antes de cualquier despliegue; los pasos de migración están
en [DESPLIEGUE_CPANEL_PRUEBAS.md](DESPLIEGUE_CPANEL_PRUEBAS.md).

Prueba unitaria/imagen: `npm test`. Para integración local reversible, aplica 011 solo a
`websdnco_db_webgoez` en `webgoez-mariadb10` y ejecuta
`node tests/whatsapp-receipt.local.mjs <hostname-verificado>` desde el contenedor Node. La prueba
crea fixtures sintéticos, comprueba acceso de sucursal, expiración, hash, snapshot fijo, HTML, PNG
decodificable y revocación y elimina los fixtures; no modifica datos comerciales existentes.
