package com.backendcreditos.mobile.network

import com.backendcreditos.mobile.BuildConfig
import kotlinx.serialization.SerializationException
import kotlinx.serialization.KSerializer
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

class GraphQlClient(
    endpoint: String = BuildConfig.GRAPHQL_ENDPOINT,
    private val http: OkHttpClient = OkHttpClient.Builder()
        .callTimeout(30, TimeUnit.SECONDS)
        .build(),
    private val assertNewWritesAllowed: () -> Unit = {}
) {
    private val url = endpoint
    private val json = Json { ignoreUnknownKeys = true; explicitNulls = false }
    private val mediaType = "application/json; charset=utf-8".toMediaType()

    suspend fun <T> execute(
        query: String,
        variables: JsonObject,
        responseSerializer: KSerializer<T>,
        token: String? = null
    ): ApiResult<T> = withContext(Dispatchers.IO) {
        if (query.trimStart().startsWith("mutation") && query !in setOf(
                GraphQlDocuments.LOGIN, GraphQlDocuments.START_BIOMETRIC_LOGIN,
                GraphQlDocuments.BIOMETRIC_LOGIN, GraphQlDocuments.START_BIOMETRIC_REGISTRATION,
                GraphQlDocuments.FINISH_BIOMETRIC_REGISTRATION,
                GraphQlDocuments.APPLY_OFFLINE_OPERATION, REPORT_APP_INSTALLATION_MUTATION
            )) {
            try {
                assertNewWritesAllowed()
            } catch (error: IllegalArgumentException) {
                return@withContext ApiResult.Rejected(error.message ?: "Actualiza la APK para continuar.", "APP_UPDATE_REQUIRED")
            }
        }
        val encodedRequest = json.encodeToString(GraphQlRequest.serializer(), GraphQlRequest(query, variables))
        val requestBuilder = Request.Builder()
            .url(url)
            .post(encodedRequest.toRequestBody(mediaType))
            .header("Accept", "application/json")
        if (token != null) requestBuilder.header("Authorization", "Bearer $token")
        try {
            http.newCall(requestBuilder.build()).execute().use { response ->
                val body = response.body?.string().orEmpty()
                if (response.code == 401) return@withContext ApiResult.AuthExpired("La sesión venció. Inicia sesión de nuevo.")
                if (response.code == 409) return@withContext ApiResult.Conflict("El servidor informó un conflicto.")
                if (response.code == 403) {
                    val error = json.decodeFromString(GraphQlEnvelope.serializer(responseSerializer), body).errors.firstOrNull()
                    return@withContext if (error?.extensions?.code == "PAYMENT_REQUIRED") {
                        ApiResult.Rejected(error.message, "PAYMENT_REQUIRED")
                    } else ApiResult.PermissionRejected("No tienes permiso para esta acción.")
                }
                if (!response.isSuccessful) {
                    return@withContext if (response.code >= 500 || response.code == 429) {
                        ApiResult.Retryable("El servidor no está disponible (${response.code}).")
                    } else {
                        ApiResult.Rejected("Solicitud rechazada por el servidor (${response.code}).")
                    }
                }
                val envelope = json.decodeFromString(
                    GraphQlEnvelope.serializer(responseSerializer),
                    body
                )
                if (envelope.errors.isNotEmpty()) {
                    val message = envelope.errors.joinToString("; ") { it.message }
                    val codes = envelope.errors.mapNotNull { it.extensions?.code }.toSet()
                    when {
                        codes.any { it in setOf("UNAUTHENTICATED", "UNAUTHORIZED", "TOKEN_EXPIRED") } ->
                            ApiResult.AuthExpired(message)
                        codes.any { it in setOf("CONFLICT", "VERSION_CONFLICT") } -> ApiResult.Conflict(
                            message,
                            envelope.errors.firstNotNullOfOrNull { error ->
                                if (error.extensions?.code in setOf("CONFLICT", "VERSION_CONFLICT")) {
                                    error.extensions?.currentRecord
                                } else null
                            }
                        )
                        codes.any { it in setOf("FORBIDDEN", "PERMISSION_DENIED") } -> ApiResult.PermissionRejected(message)
                        else -> ApiResult.Rejected(message, codes.firstOrNull())
                    }
                } else {
                    envelope.data?.let { ApiResult.Success(it) }
                        ?: ApiResult.Rejected("Respuesta GraphQL vacía.")
                }
            }
        } catch (error: IOException) {
            ApiResult.Retryable(error.message ?: "Error de conexión.")
        } catch (error: SerializationException) {
            ApiResult.Rejected("Respuesta GraphQL inválida: ${error.message ?: "formato inesperado"}")
        } catch (error: IllegalArgumentException) {
            ApiResult.Rejected("Configuración GraphQL inválida: ${error.message ?: "URL incorrecta"}")
        }
    }
}

class GraphQlApi(private val client: GraphQlClient) {
    suspend fun mobileAppPolicy(): ApiResult<MobileAppPolicyData> =
        client.execute(MOBILE_APP_POLICY_QUERY, buildJsonObject {}, MobileAppPolicyData.serializer())

    suspend fun reportAppInstallation(token: String, installationId: String): ApiResult<ReportAppInstallationData> =
        client.execute(
            REPORT_APP_INSTALLATION_MUTATION,
            buildJsonObject {
                put("installationId", installationId)
                put("versionCode", BuildConfig.VERSION_CODE)
                put("versionName", BuildConfig.VERSION_NAME)
            },
            ReportAppInstallationData.serializer(), token
        )

    suspend fun login(companyId: Int, username: String, password: String): ApiResult<LoginData> =
        client.execute(
            GraphQlDocuments.LOGIN,
            buildJsonObject {
                put("companyId", JsonPrimitive(companyId))
                put("username", JsonPrimitive(username))
                put("password", JsonPrimitive(password))
            },
            LoginData.serializer()
        )

    suspend fun startBiometricRegistration(
        token: String,
        deviceId: String
    ): ApiResult<StartBiometricRegistrationData> = client.execute(
        GraphQlDocuments.START_BIOMETRIC_REGISTRATION,
        buildJsonObject { put("deviceId", JsonPrimitive(deviceId)) },
        StartBiometricRegistrationData.serializer(),
        token
    )

    suspend fun finishBiometricRegistration(
        token: String,
        deviceId: String,
        challengeId: String,
        publicKeySpki: String,
        signature: String
    ): ApiResult<FinishBiometricRegistrationData> = client.execute(
        GraphQlDocuments.FINISH_BIOMETRIC_REGISTRATION,
        buildJsonObject {
            put("deviceId", JsonPrimitive(deviceId))
            put("challengeId", JsonPrimitive(challengeId))
            put("publicKeySpki", JsonPrimitive(publicKeySpki))
            put("signature", JsonPrimitive(signature))
        },
        FinishBiometricRegistrationData.serializer(),
        token
    )

    suspend fun startBiometricLogin(
        companyId: Int,
        username: String,
        deviceId: String
    ): ApiResult<StartBiometricLoginData> = client.execute(
        GraphQlDocuments.START_BIOMETRIC_LOGIN,
        buildJsonObject {
            put("companyId", JsonPrimitive(companyId))
            put("username", JsonPrimitive(username))
            put("deviceId", JsonPrimitive(deviceId))
        },
        StartBiometricLoginData.serializer()
    )

    suspend fun biometricLogin(
        companyId: Int,
        username: String,
        deviceId: String,
        challengeId: String,
        signature: String
    ): ApiResult<LoginData> = client.execute(
        GraphQlDocuments.BIOMETRIC_LOGIN,
        buildJsonObject {
            put("companyId", JsonPrimitive(companyId))
            put("username", JsonPrimitive(username))
            put("deviceId", JsonPrimitive(deviceId))
            put("challengeId", JsonPrimitive(challengeId))
            put("signature", JsonPrimitive(signature))
        },
        LoginData.serializer()
    )

    suspend fun branches(token: String): ApiResult<BranchesData> =
        client.execute(GraphQlDocuments.BRANCHES, buildJsonObject { }, BranchesData.serializer(), token)

    suspend fun me(token: String): ApiResult<MeData> =
        client.execute(GraphQlDocuments.ME, buildJsonObject { }, MeData.serializer(), token)

    suspend fun personDocumentTypes(token: String, branchId: String): ApiResult<PersonDocumentTypesData> {
        val id = branchId.toIntOrNull() ?: return ApiResult.Rejected("La sucursal debe tener un ID numérico.")
        return client.execute(
            GraphQlDocuments.PERSON_DOCUMENT_TYPES,
            buildJsonObject { put("branchId", JsonPrimitive(id)) },
            PersonDocumentTypesData.serializer(), token
        )
    }

    suspend fun customerCandidate(
        token: String, branchId: String, documentType: String, documentNumber: String
    ): ApiResult<CustomerCandidateData> {
        val id = branchId.toIntOrNull() ?: return ApiResult.Rejected("La sucursal debe tener un ID numérico.")
        return client.execute(
            GraphQlDocuments.CUSTOMER_CANDIDATE,
            buildJsonObject {
                put("branchId", JsonPrimitive(id))
                put("documentType", JsonPrimitive(documentType))
                put("documentNumber", JsonPrimitive(documentNumber))
            },
            CustomerCandidateData.serializer(), token
        )
    }

    suspend fun portfolio(
        token: String, branchId: String, first: Int, after: String?, snapshotCursor: String?
    ): ApiResult<PortfolioData> {
        val numericBranchId = branchId.toIntOrNull()
            ?: return ApiResult.Rejected("La sucursal debe tener un ID numérico.")
        return client.execute(
            GraphQlDocuments.PORTFOLIO,
            buildJsonObject {
                put("branchId", JsonPrimitive(numericBranchId))
                put("first", JsonPrimitive(first))
                put("after", after?.let(::JsonPrimitive) ?: JsonNull)
                put("snapshotCursor", snapshotCursor?.let(::JsonPrimitive) ?: JsonNull)
            },
            PortfolioData.serializer(),
            token
        )
    }

    suspend fun customerById(token: String, branchId: String, id: String): ApiResult<CustomerByIdData> {
        val numericBranchId = branchId.toIntOrNull()
            ?: return ApiResult.Rejected("La sucursal debe tener un ID numérico.")
        val numericCustomerId = id.toIntOrNull()
            ?: return ApiResult.Rejected("El cliente aún no tiene un ID numérico asignado por el servidor.")
        return client.execute(
            GraphQlDocuments.CUSTOMER_BY_ID,
            buildJsonObject {
                put("branchId", JsonPrimitive(numericBranchId))
                put("id", JsonPrimitive(numericCustomerId))
            },
            CustomerByIdData.serializer(),
            token
        )
    }

    suspend fun customerByDocument(
        token: String, branchId: String, documentType: String, documentNumber: String
    ): ApiResult<CustomerByDocumentData> {
        val numericBranchId = branchId.toIntOrNull()
            ?: return ApiResult.Rejected("La sucursal debe tener un ID numérico.")
        return client.execute(
            GraphQlDocuments.CUSTOMER_BY_DOCUMENT,
            buildJsonObject {
                put("branchId", JsonPrimitive(numericBranchId))
                put("documentType", JsonPrimitive(documentType))
                put("documentNumber", JsonPrimitive(documentNumber))
            },
            CustomerByDocumentData.serializer(),
            token
        )
    }

    suspend fun paymentHistory(token: String, branchId: String, creditId: String): ApiResult<PaymentHistoryData> {
        val numericBranchId = branchId.toIntOrNull()
            ?: return ApiResult.Rejected("La sucursal debe tener un ID numérico.")
        return client.execute(
            GraphQlDocuments.PAYMENT_HISTORY,
            buildJsonObject {
                put("branchId", JsonPrimitive(numericBranchId))
                put("creditId", JsonPrimitive(creditId))
            },
            PaymentHistoryData.serializer(),
            token
        )
    }

    suspend fun syncChanges(
        token: String, branchId: String, after: String, first: Int
    ): ApiResult<SyncChangesData> {
        val numericBranchId = branchId.toIntOrNull()
            ?: return ApiResult.Rejected("La sucursal debe tener un ID numérico.")
        return client.execute(
            GraphQlDocuments.SYNC_CHANGES,
            buildJsonObject {
                put("branchId", JsonPrimitive(numericBranchId))
                put("after", JsonPrimitive(after))
                put("first", JsonPrimitive(first))
            },
            SyncChangesData.serializer(),
            token
        )
    }

    suspend fun applyOfflineOperation(
        token: String,
        input: OfflineOperationInput
    ): ApiResult<ApplyOfflineOperationData> = client.execute(
        GraphQlDocuments.APPLY_OFFLINE_OPERATION,
        buildJsonObject {
            put("input", buildJsonObject {
                put("operationId", JsonPrimitive(input.operationId))
                put("branchId", JsonPrimitive(input.branchId))
                put("kind", JsonPrimitive(input.kind))
                put("entityId", JsonPrimitive(input.entityId))
                put("baseVersion", input.baseVersion?.let(::JsonPrimitive) ?: JsonNull)
                put("routeId", input.routeId?.let(::JsonPrimitive) ?: JsonNull)
                put("payload", input.payload)
            })
        },
        ApplyOfflineOperationData.serializer(),
        token
    )

    // --- Cartera sub-screens: Morosos, Retirados, Canceladas, Clientes De Cartera ---

    suspend fun branchPermissions(token: String, branchId: String): ApiResult<BranchPermissionsData> {
        val numericBranchId = branchId.toIntOrNull()
            ?: return ApiResult.Rejected("La sucursal debe tener un ID numérico.")
        return client.execute(
            GraphQlDocuments.BRANCH_PERMISSIONS,
            buildJsonObject { put("branchId", JsonPrimitive(numericBranchId)) },
            BranchPermissionsData.serializer(),
            token
        )
    }

    suspend fun bankAccounts(token: String, branchId: String): ApiResult<BankAccountsData> {
        val numericBranchId = branchId.toIntOrNull()
            ?: return ApiResult.Rejected("La sucursal debe tener un ID numérico.")
        return client.execute(
            GraphQlDocuments.BANK_ACCOUNTS,
            buildJsonObject { put("branchId", JsonPrimitive(numericBranchId)) },
            BankAccountsData.serializer(),
            token
        )
    }

    suspend fun openRouteCash(token: String, branchId: String): ApiResult<OpenRouteCashData> {
        val numericBranchId = branchId.toIntOrNull()
            ?: return ApiResult.Rejected("La sucursal debe tener un ID numérico.")
        return client.execute(
            GraphQlDocuments.OPEN_ROUTE_CASH,
            buildJsonObject { put("branchId", JsonPrimitive(numericBranchId)) },
            OpenRouteCashData.serializer(),
            token
        )
    }

    suspend fun routeSettlement(token: String, branchId: String): ApiResult<RouteSettlementData> {
        val numericBranchId = branchId.toIntOrNull()
            ?: return ApiResult.Rejected("La sucursal debe tener un ID numérico.")
        return client.execute(
            GraphQlDocuments.ROUTE_SETTLEMENT,
            buildJsonObject { put("branchId", JsonPrimitive(numericBranchId)) },
            RouteSettlementData.serializer(),
            token
        )
    }

    suspend fun routeEntries(token: String, branchId: String): ApiResult<RouteEntriesData> {
        val numericBranchId = branchId.toIntOrNull()
            ?: return ApiResult.Rejected("La sucursal debe tener un ID numérico.")
        return client.execute(
            GraphQlDocuments.ROUTE_ENTRIES,
            buildJsonObject { put("branchId", JsonPrimitive(numericBranchId)) },
            RouteEntriesData.serializer(),
            token
        )
    }

    suspend fun routeExpenseCatalog(token: String, branchId: String): ApiResult<RouteExpenseCatalogData> {
        val numericBranchId = branchId.toIntOrNull()
            ?: return ApiResult.Rejected("La sucursal debe tener un ID numérico.")
        return client.execute(
            GraphQlDocuments.ROUTE_EXPENSE_CATALOG,
            buildJsonObject { put("branchId", JsonPrimitive(numericBranchId)) },
            RouteExpenseCatalogData.serializer(),
            token
        )
    }

    suspend fun settleRoute(
        token: String, branchId: String, cash: Double, coins: Double, difference: Double
    ): ApiResult<SettleRouteData> {
        val numericBranchId = branchId.toIntOrNull()
            ?: return ApiResult.Rejected("La sucursal debe tener un ID numérico.")
        return client.execute(
            GraphQlDocuments.SETTLE_ROUTE,
            buildJsonObject {
                put("branchId", JsonPrimitive(numericBranchId))
                put("cash", JsonPrimitive(cash))
                put("coins", JsonPrimitive(coins))
                put("difference", JsonPrimitive(difference))
            },
            SettleRouteData.serializer(),
            token
        )
    }

    suspend fun receiptSequences(token: String, branchId: String): ApiResult<ReceiptSequencesData> {
        val numericBranchId = branchId.toIntOrNull()
            ?: return ApiResult.Rejected("La sucursal debe tener un ID numérico.")
        return client.execute(
            GraphQlDocuments.RECEIPT_SEQUENCES,
            buildJsonObject { put("branchId", JsonPrimitive(numericBranchId)) },
            ReceiptSequencesData.serializer(),
            token
        )
    }

    suspend fun issueReceiptLink(
        token: String, branchId: String, customerId: String, kind: String, recordId: String, format: String
    ): ApiResult<IssueReceiptLinkData> {
        val numericBranchId = branchId.toIntOrNull()
            ?: return ApiResult.Rejected("La sucursal debe tener un ID numérico.")
        val numericCustomerId = customerId.toIntOrNull()
            ?: return ApiResult.Rejected("El cliente debe tener un ID numérico.")
        return client.execute(
            GraphQlDocuments.ISSUE_RECEIPT_LINK,
            buildJsonObject {
                put("branchId", JsonPrimitive(numericBranchId))
                put("customerId", JsonPrimitive(numericCustomerId))
                put("kind", JsonPrimitive(kind))
                put("recordId", JsonPrimitive(recordId))
                put("format", JsonPrimitive(format))
            },
            IssueReceiptLinkData.serializer(),
            token
        )
    }

    suspend fun receiptLinks(
        token: String, branchId: String, afterId: String? = null
    ): ApiResult<ReceiptLinksData> {
        val numericBranchId = branchId.toIntOrNull()
            ?: return ApiResult.Rejected("La sucursal debe tener un ID numérico.")
        return client.execute(
            GraphQlDocuments.RECEIPT_LINKS,
            buildJsonObject {
                put("branchId", JsonPrimitive(numericBranchId))
                put("afterId", afterId?.let(::JsonPrimitive) ?: JsonNull)
            },
            ReceiptLinksData.serializer(),
            token
        )
    }

    suspend fun revokeReceiptLink(
        token: String, branchId: String, id: String
    ): ApiResult<RevokeReceiptLinkData> {
        val numericBranchId = branchId.toIntOrNull()
            ?: return ApiResult.Rejected("La sucursal debe tener un ID numérico.")
        return client.execute(
            GraphQlDocuments.REVOKE_RECEIPT_LINK,
            buildJsonObject {
                put("branchId", JsonPrimitive(numericBranchId))
                put("id", JsonPrimitive(id))
            },
            RevokeReceiptLinkData.serializer(),
            token
        )
    }

    suspend fun defaultersOfPortfolio(token: String, branchId: String): ApiResult<DefaultersOfPortfolioData> {
        val numericBranchId = branchId.toIntOrNull()
            ?: return ApiResult.Rejected("La sucursal debe tener un ID numérico.")
        return client.execute(
            GraphQlDocuments.DEFAULTERS_OF_PORTFOLIO,
            buildJsonObject { put("branchId", JsonPrimitive(numericBranchId)) },
            DefaultersOfPortfolioData.serializer(),
            token
        )
    }

    suspend fun withdrawnOfPortfolio(token: String, branchId: String): ApiResult<WithdrawnOfPortfolioData> {
        val numericBranchId = branchId.toIntOrNull()
            ?: return ApiResult.Rejected("La sucursal debe tener un ID numérico.")
        return client.execute(
            GraphQlDocuments.WITHDRAWN_OF_PORTFOLIO,
            buildJsonObject { put("branchId", JsonPrimitive(numericBranchId)) },
            WithdrawnOfPortfolioData.serializer(),
            token
        )
    }

    suspend fun cancelledCredits(
        token: String, branchId: String, dateFrom: String, dateTo: String
    ): ApiResult<CancelledCreditsData> {
        val numericBranchId = branchId.toIntOrNull()
            ?: return ApiResult.Rejected("La sucursal debe tener un ID numérico.")
        return client.execute(
            GraphQlDocuments.CANCELLED_CREDITS,
            buildJsonObject {
                put("branchId", JsonPrimitive(numericBranchId))
                put("dateFrom", JsonPrimitive(dateFrom))
                put("dateTo", JsonPrimitive(dateTo))
            },
            CancelledCreditsData.serializer(),
            token
        )
    }

    suspend fun portfolioClients(token: String, branchId: String): ApiResult<PortfolioClientsData> {
        val numericBranchId = branchId.toIntOrNull()
            ?: return ApiResult.Rejected("La sucursal debe tener un ID numérico.")
        return client.execute(
            GraphQlDocuments.PORTFOLIO_CLIENTS,
            buildJsonObject { put("branchId", JsonPrimitive(numericBranchId)) },
            PortfolioClientsData.serializer(),
            token
        )
    }

    suspend fun customerRating(token: String, branchId: String, customerId: String): ApiResult<CustomerRatingData> {
        val numericBranchId = branchId.toIntOrNull()
            ?: return ApiResult.Rejected("La sucursal debe tener un ID numérico.")
        val numericCustomerId = customerId.toIntOrNull()
            ?: return ApiResult.Rejected("El cliente aún no tiene un ID numérico asignado por el servidor.")
        return client.execute(
            GraphQlDocuments.CUSTOMER_RATING,
            buildJsonObject {
                put("branchId", JsonPrimitive(numericBranchId))
                put("customerId", JsonPrimitive(numericCustomerId))
            },
            CustomerRatingData.serializer(),
            token
        )
    }

    suspend fun rateCustomer(
        token: String, branchId: String, customerId: String, score: Int, reason: String, expectedRating: String
    ): ApiResult<RateCustomerData> {
        val numericBranchId = branchId.toIntOrNull()
            ?: return ApiResult.Rejected("La sucursal debe tener un ID numérico.")
        val numericCustomerId = customerId.toIntOrNull()
            ?: return ApiResult.Rejected("El cliente aún no tiene un ID numérico asignado por el servidor.")
        com.backendcreditos.mobile.ratingInputError(score, reason)?.let { return ApiResult.Rejected(it) }
        return client.execute(
            GraphQlDocuments.RATE_CUSTOMER,
            buildJsonObject {
                put("branchId", JsonPrimitive(numericBranchId))
                put("customerId", JsonPrimitive(numericCustomerId))
                put("score", JsonPrimitive(score))
                put("reason", JsonPrimitive(reason.trim()))
                put("expectedRating", JsonPrimitive(expectedRating))
            },
            RateCustomerData.serializer(),
            token
        )
    }

    suspend fun restoreCredit(token: String, branchId: String, creditId: String): ApiResult<RestoreCreditData> {
        val numericBranchId = branchId.toIntOrNull()
            ?: return ApiResult.Rejected("La sucursal debe tener un ID numérico.")
        return client.execute(
            GraphQlDocuments.RESTORE_CREDIT,
            buildJsonObject {
                put("branchId", JsonPrimitive(numericBranchId))
                put("creditId", JsonPrimitive(creditId))
            },
            RestoreCreditData.serializer(),
            token
        )
    }
}
