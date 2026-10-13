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
| `MOBILE_APP_LATEST_VERSION_CODE` | Latest APK version code; defaults to `1` only when unset. |
| `MOBILE_APP_MIN_VERSION_CODE` | Minimum APK version code for creating new client operations; defaults to `1` only when unset. |
| `MOBILE_APP_LATEST_VERSION_NAME` | Latest APK display version; default `0.1.0`, 1..80 printable characters. |
| `MOBILE_APP_DOWNLOAD_URL` | Absolute HTTPS APK download URL without credentials, or empty (default) only when the minimum version code is `1`. |
| `MOBILE_APP_UPDATE_MESSAGE` | Public update message, default empty. Do not put private information here. |

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

### APK policy and installation reports

`mobileAppPolicy: MobileAppPolicy!` is public and does not require the installation
migration. Send it as a standalone query with direct top-level `mobileAppPolicy`
fields (aliases supported). Such HTTP POST/GET requests skip authentication and
payment checks even when a stale bearer token is attached. Mixed/private queries
retain normal authentication/payment checks; reporting remains authenticated.
Configuration is validated when queried: version codes must be decimal
positive GraphQL Int values (maximum `2147483647`), with
`latestVersionCode >= minimumVersionCode > 0`. Empty, malformed or inconsistent
configured values return `CONFIGURATION_ERROR`; they never silently revert to defaults.
If `minimumVersionCode > 1`, an empty download URL also returns
`CONFIGURATION_ERROR`: a mandatory update must have an HTTPS download location.

Defaults remain latest/minimum `1` for rollout compatibility. For the initial
APK `0.2.0` rollout, set `MOBILE_APP_LATEST_VERSION_CODE=2`,
`MOBILE_APP_LATEST_VERSION_NAME=0.2.0`, and `MOBILE_APP_MIN_VERSION_CODE=1`;
publish the APK at `MOBILE_APP_DOWNLOAD_URL` before raising the minimum.
**Legacy APK version code 1 has no policy client and cannot be remotely forced
to update through this policy.** Users must first install APK version code 2+
to receive client-side policy enforcement; raising the minimum alone cannot
enforce it on APK 1.

Manually apply the additive, rerunnable `migrations/012_app_installations.sql`
before using either installation endpoint. There is no automatic schema creation.
A missing table returns `CONFIGURATION_ERROR` naming that migration.

```graphql
query {
  mobileAppPolicy {
    latestVersionCode minimumVersionCode latestVersionName downloadUrl message
  }
}

# These two operations require the normal Authorization bearer token.
mutation Report($installationId: String!, $versionCode: Int!, $versionName: String!) {
  reportAppInstallation(
    installationId: $installationId, versionCode: $versionCode, versionName: $versionName
  )
}

query {
  appInstallations {
    installationId userId employeeId employeeName versionCode versionName lastSeenAt
  }
}
```

`reportAppInstallation(...): Boolean!` returns `true` after persistence. Supply a
random, locally generated installation identifier (not a hardware ID or secret),
1..120 ASCII letters/digits or `._:-`; codes must be positive GraphQL Ints and names
1..80 printable characters. The authenticated company/user identity is used, never
accepted from the client. Repeated reports replace the latest version/name and set a
server UTC timestamp, including after a downgrade. The same identifier on another
account/company does not overwrite the first account's report.

`appInstallations: [AppInstallation!]!` has **no arguments**, returns at most 100
latest reports ordered by `lastSeenAt` descending (stable user/installation tie-break),
and never crosses companies. `Super Administrador` sees all company reports;
office administrators see employees currently assigned to offices they administer,
plus their own reports; ordinary users see only their own. Office authority uses
`tbl_oficina.idempleado_administrador` and `tbl_empleado.idoficina`, as payroll does,
not a role label. `employeeId: Int` and `employeeName: String` are nullable and reflect
the current employee association; other fields are non-null (`userId`/`versionCode`
are Int, the rest String). `lastSeenAt` is ISO-8601 UTC. This is a latest-report
inventory, not an audit history or cryptographically verified APK attestation.

**Enforcement limitation:** policy is advisory on the backend. No version header,
reported version or minimum code blocks GraphQL writes. Pending offline operations
must still upload, and older APKs may not support reporting at all. The client must
enforce the minimum for **new queue enqueues** without preventing previously pending
uploads. The server cannot reliably distinguish newly created operations from
previously pending offline work; reported versions are client-supplied telemetry,
not authorization evidence.

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

Each payroll includes nullable `officeId`/`officeName` and `suggested`: the
employee's office matches the selected branch's office. Payrolls are ordered
with that office first, then other offices alphabetically, then employee names.
Web/APK display separate office groups; these suggestions do not change
authorization or automatically select an employee. Existing cached APK catalogs
can be refreshed to receive the added fields; older clients can keep requesting
only `id`/`name`.

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

## Calificación manual de clientes (migración 013)

**Desplegar `migrations/013_customer_rating.sql` (manual, después de 001–012) ANTES de publicar la versión del APK que la usa.** MariaDB 10.3+, usa `DELIMITER $$`. Re-ejecutarla solo recrea DDL (`CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE TRIGGER`): no inserta eventos, no hace backfill ni modifica filas de negocio.

- La nota vive en `tbl_clientes.str_calificacion` como string exacto `'1'`..`'10'`; cualquier otro valor (`'nuevo'`, `''`, `' 7'`) = sin calificar, sin recortar (igual que PHP y Android). `rating` en DTO/sync no cambia; el UPDATE ya dispara `trg_mobile_cliente_au` (evento `customer`) para PHP y Node, así que ese trigger no se tocó.
- Categorías: 9–10 `Excelente`, 7–8 `Bueno`, 5–6 `Regular`, 1–4 `Requiere seguimiento`. Desde la migración 014, `'nuevo'`/`''` se muestra como `score` 5 y `Inicial · poca historia`; cualquier otro valor no numérico (`' 7'`, `'abc'`) como `score` null y `Nota por revisar` (igual que Android; `customerRating` lo registra con `console.warn('[customer-rating] ...')` solo con ids, y el motor lo reemplaza al evaluar auditándolo en el historial). `NULL` en BD se lee como `''` (`COALESCE`).
- `mobile_customer_rating_history`: id, idglobal, idcliente, idsucursal, score, previous_score, reason ≤500, source `manual`, created_by = idusuario, created_at `DATETIME(3)` UTC.
- `mobile_customer_rating_event` (historial append-only de eventos reales; sin índice único): id, idglobal, idcliente, idsucursal, event_type, source_record_id (iddescripcion/idtarjeta original), old_state, new_state, previous_amount, amount, occurred_at `DATETIME(3)` UTC, processed_at, state `pending`. Índice no único `(idglobal, event_type, source_record_id)`.
- Automatización preparada y **DESACTIVADA**: triggers `trg_rating_*` (`FOLLOWS` de los de sync, que no se modifican) registran `payment_created` (amount=dec_abono), `payment_updated` solo si cambia `str_estado` o `dec_abono` (estados/montos anterior y nuevo), `payment_deleted`, `credit_created` (amount=dec_valor) y `credit_status_changed` (estados; montos = dec_resta anterior/nuevo). Sin handlers ni `IGNORE`: si el evento falla, falla la escritura legacy y se revierte junto con sus eventos de sync (no se pierden eventos en silencio). La migración 014 amplía estos triggers y el worker automático (desactivado por defecto) consume los eventos; ver la sección siguiente.
- GraphQL (solo online, no pasa por la cola offline):
  - `customerRating(branchId: Int!, customerId: Int!): CustomerRating!` — cualquier usuario con acceso a la sucursal y el cliente en ella.
  - `rateCustomer(branchId: Int!, customerId: Int!, score: Int!, reason: String!, expectedRating: String!): CustomerRating!` — solo Super Administrador o administrador de la oficina de la sucursal (`FORBIDDEN`). `score` entero 1..10; `reason` recortado como PHP `trim()` y de 5 a 500 caracteres Unicode (code points, como `mb_strlen`); `expectedRating` ≤50 code points y debe ser igual, exacto y sin recortar, a `COALESCE(str_calificacion,'')` bloqueado con `FOR UPDATE` (si no → `CONFLICT`). Repetir la misma nota con nuevo motivo es válido. Inserta historial y actualiza la nota en la misma transacción.
  - `CustomerRating { score: Int, rawRating: String!, label: String!, canRate: Boolean!, history: [CustomerRatingEntry!]! }` (últimos 20) y `CustomerRatingEntry { id: ID!, score: Int, previousScore: Int, reason: String!, source: String!, createdAt: String!, createdBy: Int! }` (`createdAt` ISO UTC con milisegundos, p. ej. `2026-10-13T14:31:25.514Z`).
- Prueba de BD opt-in `tests/customer-rating-db.test.mjs` (no la ejecuta `npm test`): clona **solo el esquema** (tablas, vistas, rutinas y triggers) previo a 013 de `RATING_TEST_SOURCE_DB` en una base nueva `tmp_rating_test_<timestamp>_<random>`, aplica 013 dos veces y luego 014 dos veces, crea filas de prueba solo ahí y siempre hace `DROP` de esa base. Lee el DDL con la base origen como esquema por defecto y rechaza cualquier DDL que nombre la base origen. Cubre triggers de pago (alta, update sin cambios, update real, borrado y reinserción), cambios de estado del crédito con estados/montos, pago huérfano con rollback explícito, sync de cliente para escrituras Node y tipo PHP, el servicio (alcance, permisos, conflicto exacto, misma nota y auditoría) y, con 014, los triggers ampliados (montos/plazo/modo/fechas, reasignación con evento para cliente anterior y nuevo, `credit_deleted`), el worker (eventos, arranque, nota efectiva, prioridad y vencimiento manual, auditoría automática sin inundar) y sus fallos explícitos (rollback, `attempts`, `last_error`, `failed`). Requiere un usuario con `CREATE`/`DROP DATABASE`. Ejecutar después de `npm run build` (la contraseña se pasa por entorno, nunca en la línea de comando):

  ```sh
  docker exec -e RUN_CUSTOMER_RATING_DB_TESTS=1 -e RATING_TEST_DB_HOST=database \
    -e RATING_TEST_DB_USER=root -e RATING_TEST_DB_PASSWORD -e RATING_TEST_SOURCE_DB=websdnco_db_webgoez \
    -w /var/www/html/projects/backend-creditos-apk webgoez-node node --test tests/customer-rating-db.test.mjs
  ```
  (`RATING_TEST_DB_PASSWORD` debe estar exportada en la shell del host; `RATING_TEST_DB_PORT` opcional, 3306.)

## Calificación automática de clientes (migración 014)

**Orden de despliegue: aplicar `migrations/013` y luego `migrations/014_customer_rating_automatic.sql` (manual, `DELIMITER $$`) ANTES de desplegar esta API y antes de publicar el APK que muestra los campos nuevos.** Sin 014 fallan `customerRating`/`rateCustomer` y también `portfolio`, `customerById`, `customerByDocument` y `syncChanges` (leen `mobile_customer_rating_state` con `LEFT JOIN`). 014 es re-ejecutable (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE TRIGGER`) y no toca filas de negocio. Su única inserción (11 sentencias en total) preserva notas manuales vigentes de la etapa 013: para cada cliente sin estado cuya última fila manual del historial tiene `score` no nulo, `created_at + INTERVAL 7 DAY > UTC_TIMESTAMP(3)` y `BINARY str_calificacion = CAST(score AS CHAR)` (comparación exacta, independiente del charset de la conexión del cliente `mariadb`), crea el estado con `manual_score=score`, `manual_until=created_at + 7 días` (nunca se extiende ni se reinicia al re-ejecutar: `NOT EXISTS` en el estado) y `next_evaluation_at=UTC_TIMESTAMP(3)`. No hay backfill de notas automáticas. El usuario de la API necesita `SELECT/INSERT/UPDATE` en `mobile_customer_rating_state` y `mobile_customer_rating_event`.

Matemática explicable, sin IA externa ni dependencias nuevas. **La automatización está DESACTIVADA por defecto** (`CUSTOMER_RATING_AUTOMATION` vacío o `0`): no se calcula ni se escribe nada automático; `customerRating` solo lee el estado guardado (igual que PHP, sin duplicar el motor) y `str_calificacion` sigue siendo la legacy/manual.

### Esquema 014

- `mobile_customer_rating_state` PK `(idglobal, idcliente)`: `automatic_score TINYINT UNSIGNED NOT NULL DEFAULT 5`, `manual_score TINYINT UNSIGNED NULL`, `manual_until DATETIME(3) NULL` (UTC), `evaluated_at DATETIME(3) NULL` (UTC; NULL = evaluación pendiente, p. ej. fila creada por un guardado manual), `confidence VARCHAR(16) NOT NULL DEFAULT 'initial'`, `explanation VARCHAR(500) NOT NULL DEFAULT 'Nota inicial neutral; evaluación matemática pendiente.'`, `metrics_json LONGTEXT NULL DEFAULT NULL` (versión 1, uso interno), `next_evaluation_at DATETIME(3) NULL DEFAULT NULL` (UTC). Índices `ix_rating_state_next(next_evaluation_at)`, `ix_rating_state_manual(manual_until)`.
- `mobile_customer_rating_event` gana: `attempts INT NOT NULL DEFAULT 0`, `last_error VARCHAR(500)`, `old_value/new_value DECIMAL(12,2)` (dec_valor), `old_term/new_term INT`, `old_mode/new_mode VARCHAR(20)`, `old_record_at/new_record_at DATETIME` (created_at legacy tal cual, reloj de la BD), `old_parent_id/new_parent_id VARCHAR(100)` (idtarjeta del pago o idcliente del crédito). `state`: `pending` → `processed` | `ignored` (cliente inexistente) | `failed` (tras 5 intentos).
- Triggers (mismos nombres, `FOLLOWS` de los de sync, que no se tocan; sin handlers ni `IGNORE`): pagos `payment_created`, `payment_updated` (si cambia estado, abono, created_at, idtarjeta, idglobal o descripción), `payment_moved_out` (al cliente anterior si el pago cambia de tarjeta), `payment_deleted`; créditos `credit_created`, `credit_status_changed`/`credit_changed` (si cambia estado, saldo, valor, plazo, modo, created_at o cliente), `credit_moved_out` (al cliente anterior si se reasigna), `credit_deleted` (nuevo trigger `trg_rating_tarjeta_ad`). Triggers nuevos `trg_rating_state_ai/au` en `mobile_customer_rating_state`: emiten el mismo evento de sync `customer UPDATE` que `trg_mobile_cliente_au` (todas las sucursales del cliente) al insertar el estado o cuando cambian `confidence`, `manual_score`, `manual_until` o `evaluated_at` pasa de NULL a valor; las reevaluaciones diarias sin cambio visible no emiten. Un guardado manual genera dos eventos `customer` (estado + `tbl_clientes`); los clientes los aplican de forma idempotente. **Cambio de semántica respecto a 013:** en eventos de crédito `previous_amount/amount` = `dec_resta` (saldo) también en `credit_created` (013 guardaba `dec_valor`); el valor va en `old_value/new_value`.

### Nota efectiva (`tbl_clientes.str_calificacion`, sincronizada a APK/web)

1. Manual vigente (`manual_until > UTC_TIMESTAMP(3)`): `manual_score` (`'1'`..`'10'`). Ventana fija de **7 días** UTC exactos desde el guardado (Node y PHP).
2. Si no, confianza `initial`: `'nuevo'` (se muestra 5 · `Inicial · poca historia`; nunca un 10 inventado).
3. Si no, `automatic_score`.

Solo se hace `UPDATE` si el valor efectivo cambia (`''`/`'nuevo'` se consideran iguales), así que el trigger existente `trg_mobile_cliente_au` emite el evento de sync del cliente solo cuando hay cambio real. Los cambios automáticos no tocan `update_at`. Campos nuevos nullable en `Customer` (GraphQL `portfolio`, `customerById`, `customerByDocument`), en el payload `customer` de `syncChanges` y en el registro actual de conflictos de operaciones: `ratingSource` = `'manual'` con manual vigente o, sin fila de estado, si `rating` es exactamente `'1'..'10'` (nota anterior); `'automatic'` si ya fue evaluado; si no `null`; `ratingConfidence` = `confidence` si ya fue evaluado, si no `null`. Regla de etiqueta común (web, APK, API): `Nota por revisar` (score null) si `rating` no es `'1'..'10'`, `'nuevo'` ni `''`; `Inicial · poca historia` si es `'nuevo'`/`''` o si la confianza es `initial` sin manual vigente; si no, la categoría de la nota. La explicación y las métricas solo salen en `customerRating`. Historial automático: `source='automatic'`, `created_by=0`, `reason` = explicación, `score` NULL cuando vuelve a `'nuevo'`, `idsucursal` del crédito más reciente; se escribe solo si cambia la nota efectiva o al vencer una manual (traspaso, una sola vez: el worker limpia `manual_score/manual_until`), aunque la nota sea la misma. Un cambio solo de origen/confianza con la misma nota no toca `tbl_clientes`, pero el trigger `trg_rating_state_au` (cambia `confidence`, `manual_score`, `manual_until` o la nulidad de `evaluated_at`) emite el evento `customer UPDATE` de sync para que APK/web reciban `ratingSource`/`ratingConfidence`; refrescar solo `evaluated_at` no genera sync. Primera evaluación de un cliente sin estado con nota numérica: si la última manual del historial coincide con la nota y sigue dentro de sus 7 días, se respeta hasta `created_at + 7 días` (sin extender); si no, la nota se trata como anterior y el motor la reemplaza auditando el traspaso.

Guardado manual PHP (contrato, misma transacción y este orden de bloqueo): `SELECT … FROM tbl_clientes … FOR UPDATE` → comparación exacta → `INSERT` historial `manual` → upsert de estado → `UPDATE tbl_clientes SET str_calificacion`:

```sql
INSERT INTO mobile_customer_rating_state (idglobal,idcliente,manual_score,manual_until,next_evaluation_at)
VALUES (?,?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 7 DAY),UTC_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE manual_score=VALUES(manual_score), manual_until=VALUES(manual_until),
  next_evaluation_at=VALUES(next_evaluation_at);
```

(`VALUES (?,?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 7 DAY),UTC_TIMESTAMP(3))`: la reevaluación queda vencida de inmediato y el worker la procesa en la siguiente pasada; cada guardado, también con la misma nota, reinicia la ventana de 7 días.)

El motor nunca pisa una manual vigente; sigue calculando `automatic_score` por debajo y al vencer la ventana la reemplaza.

### Fórmula (src/services/ratingEngine.ts)

Fechas = día civil en `APP_TIME_ZONE` (por defecto `America/Bogota`); los DATETIME legacy (reloj de la BD, `NOW()`) se convierten a UTC con el desfase `NOW()-UTC_TIMESTAMP()`. Se usan todas las tarjetas del cliente en la empresa (todas las sucursales), excepto `fallecio`/`discapacitado` (no cuentan) y tarjetas cerradas (`cancelado` o saldo 0) creadas hace más de 800 días.

- **Calendario (igual que la web, `Cartera.js`)**: inicio = `created_at` de la tarjeta; cuota k: `Diario` = k-ésimo día siguiente sin domingos; `Semanal` = inicio + 7k; `Quincenal` = inicio + 15k; `Mensual` = mismo día del mes (meses sin ese día se saltan, como la web). Número de cuotas = `int_tiempo`. Clasificación de `tbl_descripcion` (igual que `clasificarUltimoRegistro` de la web): **efectivo** = `Abono`, `c-Inicial`, `Inicial`, `Cancelado`/`Cancelada`, `Pagado` (negativo = pago, positivo = reversión); **intereses** = positivos `Intereses`/`Intereces` (refinanciación, que además amplía `int_tiempo`); **ajuste contable** = todo lo demás (`Descuento:`, `Saldo corregido`, otros). Obligación T = `dec_valor` + intereses; adeudado A = min(T, max(0, T + suma de ajustes)). La cuota k está cubierta el primer día en que el **efectivo** acumulado × plazo ≥ min(k × T, A × plazo). Los ajustes **nunca cuentan como pago** (no dan puntualidad, constancia ni carga); solo condonan las últimas cuotas: la cuota k con (k−1) × T ≥ A × plazo no se evalúa (p. ej. descuento por cancelar antes). La explicación indica cuántos ajustes y cuotas condonadas hubo. **Los adelantos cubren cuotas futuras**: si ya están cubiertas no se exige pago diario.
- Gracia/periodo por modo: Diario 1/1, Semanal 2/7, Quincenal 3/15, Mensual 5/30 días.
- **Puntualidad (50%)**: cuotas vencidas (vencimiento < hoy) de los últimos **365 días**: 1 si se cubrió con atraso ≤ gracia, 0.5 si ≤ gracia+periodo, 0 si más (una cuota no cubierta cuenta atraso hasta hoy). Factor = suma / cuotas evaluadas.
- **Atraso actual (25%)**: en créditos abiertos, días desde la cuota sin cubrir más antigua menos la gracia; factor = max(0, 1 − días/60).
- **Constancia (15%)**: semanas (lunes–domingo) completas de los últimos 365 días con alguna cuota vencida que no estaba cubierta al empezar la semana; factor = semanas con algún pago en efectivo / semanas requeridas (1 si no hay).
- **Carga (10%)**: 1 si no hay créditos abiertos o no hay atraso (varias tarjetas al día no penalizan). Con atraso: pagos habituales en efectivo por día en los últimos min(90, días desde el primer crédito abierto) / suma de cuota diaria equivalente de todas las tarjetas abiertas (Diario ×6/7, Semanal /7, Quincenal /15, Mensual ×12/365), tope 1; requiere ≥7 días de historia.
- **Nota**: S = Σ peso·factor / 100; continua = 1 + 9·S; se aplica el tope de confianza y se redondea a 1..10.
- **Confianza y topes**: <8 cuotas evaluadas sin atraso → `initial`, 5 (efectiva `'nuevo'`); <8 con atraso → `limited`, máximo 5; <30 cuotas o <90 días desde la primera cuota evaluada → `limited`, máximo 8; si no `established`. Crédito abierto con datos inválidos (modo fuera de los 4, plazo no entero 1..2000, valor ≤0, fecha inválida/futura o saldo ≠ valor + Σabonos) → se excluye, se informa como "evidencia insuficiente" y la nota queda `limited` con máximo 6. Sin créditos → `initial`.
- **Histéresis**: con la misma confianza se conserva la nota automática anterior salvo que la continua se aleje ≥1 punto (evita oscilaciones y spam de historial).
- Explicación en español ≤500 caracteres con los cuatro factores, atraso, constancia, carga, exclusiones y topes.
- Pesos por entorno, enteros 0..100 que deben sumar 100 (si no, `CONFIGURATION_ERROR` y la API no arranca): `RATING_WEIGHT_PUNCTUALITY=50`, `RATING_WEIGHT_DELAY=25`, `RATING_WEIGHT_CONSISTENCY=15`, `RATING_WEIGHT_LOAD=10`. La ventana manual (7 días) es fija.

### Worker y entorno

- `CUSTOMER_RATING_AUTOMATION=1` activa el worker dentro del proceso de la API (se inicia en `src/index.ts`, se detiene en `SIGTERM/SIGINT` esperando la pasada en curso antes de cerrar el pool). Valores distintos de `0`/`1` abortan el arranque. Activarlo solo después de aplicar y verificar 014. Cada fallo (evento, cliente vencido o arranque) se registra explícitamente con `console.error('[customer-rating] ...')`, se revierte su transacción y el evento acumula `attempts`/`last_error` (estado `failed` tras 5 intentos); no se suprime.
- `RATING_WORKER_INTERVAL_MS` (5000..3600000, defecto 30000), `RATING_WORKER_BATCH` (1..1000, defecto 100).
- Cada pasada toma `GET_LOCK('mobile_customer_rating_worker',0)` (una sola instancia procesa), y en transacciones por cliente (bloqueo `tbl_clientes FOR UPDATE` y luego el estado): 1) eventos `pending` agrupados por cliente; 2) estados con `next_evaluation_at` vencido (diario a las 00:05 locales si hay créditos abiertos, cada 7 días si solo hay historia, y al vencer la manual); 3) arranque: clientes **con tarjetas** sin estado. Errores: rollback del cliente, `attempts+1`, `last_error`, `failed` tras 5 intentos, log `[customer-rating]` sin credenciales; una reevaluación fallida se reintenta en 1 hora.
- Con la automatización activa, `customerRating` también recalcula y persiste al leer (misma transacción) y `rateCustomer` devuelve la nota automática actual.
- **Aviso de carga**: el arranque evalúa todos los clientes con tarjetas (~88k en local, ~20–25 ms cada uno) y cambia `str_calificacion` de los que salen de `'nuevo'`; cada cambio genera un evento de sync `customer UPDATE` (resincronización en los APK) y una fila de historial automática. Con los valores por defecto procesa ~200 clientes/minuto (≈7 h); ajustar `RATING_WORKER_BATCH`/intervalo según la carga aceptable.

### Operación (aplicar 014 y activar el worker)

```bash
# Desde la raíz docker (la contraseña se toma de .env por entorno, nunca en la línea de comando)
set -a; . ./.env; set +a
docker exec -i -e MYSQL_PWD="$MYSQL_ROOT_PASSWORD" webgoez-mariadb10 \
  mariadb -uroot websdnco_db_webgoez < www/projects/backend-creditos-apk/migrations/014_customer_rating_automatic.sql
# Activar (backend .env, no versionado) y reiniciar solo Node: en desarrollo `tsx watch` reinicia al tocar src/index.ts
#   CUSTOMER_RATING_AUTOMATION=1  RATING_WORKER_BATCH=50  RATING_WORKER_INTERVAL_MS=30000
touch www/projects/backend-creditos-apk/src/index.ts
# Seguimiento
docker logs --since 10m webgoez-node 2>&1 | grep customer-rating
#   SELECT COUNT(*), SUM(evaluated_at IS NOT NULL) FROM mobile_customer_rating_state;
#   SELECT state, COUNT(*), MAX(attempts) FROM mobile_customer_rating_event GROUP BY state;
```

Usar el cliente `mariadb` (respeta `DELIMITER $$` y el `;` dentro del texto por defecto). La conexión del cliente es `utf8mb3_general_ci` y `tbl_clientes` es `utf8mb3_spanish2_ci`: por eso la semilla compara con `BINARY`; la prueba de BD aplica 014 con `SET NAMES utf8mb3` para cubrirlo. Desactivar: `CUSTOMER_RATING_AUTOMATION=0` y reiniciar Node (el estado guardado se sigue leyendo).

### GraphQL

Argumentos sin cambios. `CustomerRating` queda:

```graphql
type CustomerRating {
  score: Int            # efectiva; 5 cuando rawRating no es '1'..'10'
  rawRating: String!    # str_calificacion exacto, para expectedRating
  label: String!        # Excelente | Bueno | Regular | Requiere seguimiento | Inicial · poca historia (regla común)
  canRate: Boolean!
  automaticScore: Int!  # 1..10 (5 en initial)
  source: String!       # manual | automatic
  manualUntil: String   # ISO UTC con ms, solo con manual vigente
  evaluatedAt: String   # ISO UTC, null = evaluación pendiente
  confidence: String!   # initial | limited | established
  explanation: String!  # español, ≤500
  history: [CustomerRatingEntry!]!  # últimos 20, manual y automatic (createdBy 0)
}
```

Sin evaluación aún (sin estado o `evaluated_at` NULL) se devuelve explícitamente pendiente: `automaticScore` 5, `confidence` `initial`, `evaluatedAt` null, `explanation` `Nota inicial neutral; evaluación matemática pendiente.`; `source` = `manual` si hay manual vigente, si no `automatic`. Sin fila de estado y `rating` numérico (nota anterior): `score` = esa nota, `source` `manual`, `manualUntil` = última manual del historial + 7 días si coincide y sigue vigente (si no null), `explanation` `Nota anterior; evaluación matemática pendiente.`, `confidence` `initial`, `evaluatedAt` null. Con la automatización desactivada siempre se devuelve el estado guardado (nada se calcula); activada, la lectura recalcula y persiste. `evaluatedAt` permite mostrar la frescura (worker cada 30 s por defecto).

Riesgos documentados: la explicación agrega todas las sucursales de la empresa; el desfase del reloj de BD se toma de `NOW()-UTC_TIMESTAMP()` en cada evaluación; `Mensual` salta meses sin el día de inicio (igual que la web); el módulo no toma decisiones financieras (solo muestra la nota).
