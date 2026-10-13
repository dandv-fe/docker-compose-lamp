package com.backendcreditos.mobile.network

import kotlinx.serialization.SerializationException
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GraphQlContractTest {
    private val json = Json { ignoreUnknownKeys = true }

    @Test fun requiredUpdateBlocksNewOnlineMutationsButAllowsPendingUploadsAndReads() = runBlocking {
        var requests = 0
        val http = OkHttpClient.Builder().addInterceptor { chain ->
            requests++
            Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1)
                .code(200).message("OK")
                .body("""{"data":{"reportAppInstallation":true}}""".toResponseBody()).build()
        }.build()
        val client = GraphQlClient("https://example.invalid/graphql", http) {
            throw IllegalArgumentException("Actualiza la APK")
        }
        for (mutation in listOf(GraphQlDocuments.SETTLE_ROUTE, GraphQlDocuments.RESTORE_CREDIT,
                GraphQlDocuments.ISSUE_RECEIPT_LINK, GraphQlDocuments.REVOKE_RECEIPT_LINK,
                GraphQlDocuments.RATE_CUSTOMER)) {
            val result = client.execute(mutation, buildJsonObject {}, ReportAppInstallationData.serializer(), "token")
            assertEquals(ApiResult.Rejected("Actualiza la APK", "APP_UPDATE_REQUIRED"), result)
        }
        assertEquals(0, requests)
        for (allowed in listOf(GraphQlDocuments.APPLY_OFFLINE_OPERATION, GraphQlDocuments.ME,
                GraphQlDocuments.LOGIN, REPORT_APP_INSTALLATION_MUTATION)) {
            assertTrue(client.execute(allowed, buildJsonObject {}, ReportAppInstallationData.serializer(), "token") is ApiResult.Success)
        }
        assertEquals(4, requests)
    }

    @Test fun customerRatingDocumentsMatchBackendContractAndDecode() {
        val fields = "score label rawRating canRate automaticScore source manualUntil evaluatedAt confidence explanation"
        val history = "history { id score previousScore reason source createdAt createdBy }"
        for (document in listOf(GraphQlDocuments.CUSTOMER_RATING, GraphQlDocuments.RATE_CUSTOMER)) {
            assertTrue(document.contains(fields))
            assertTrue(document.contains(history))
            assertTrue(document.contains("branchId: Int!"))
            assertTrue(document.contains("customerId: Int!"))
        }
        assertTrue(GraphQlDocuments.CUSTOMER_RATING.trimStart().startsWith("query CustomerRating"))
        assertTrue(GraphQlDocuments.CUSTOMER_RATING.contains("customerRating(branchId: \$branchId, customerId: \$customerId)"))
        assertTrue(GraphQlDocuments.RATE_CUSTOMER.trimStart().startsWith("mutation RateCustomer"))
        assertTrue(GraphQlDocuments.RATE_CUSTOMER.contains("score: Int!"))
        assertTrue(GraphQlDocuments.RATE_CUSTOMER.contains("reason: String!"))
        assertTrue(GraphQlDocuments.RATE_CUSTOMER.contains("expectedRating: String!"))
        assertTrue(GraphQlDocuments.RATE_CUSTOMER.contains("expectedRating: \$expectedRating"))
        for (document in listOf(GraphQlDocuments.PORTFOLIO, GraphQlDocuments.CUSTOMER_BY_ID, GraphQlDocuments.CUSTOMER_BY_DOCUMENT)) {
            assertTrue(document.contains(" rating ratingSource ratingConfidence guarantorPersonId"))
        }
        val customer = json.decodeFromString(
            CustomerDto.serializer(),
            """{"id":10,"companyId":1,"personId":3,"firstName":"Ana","lastName":"Ruiz","rating":"nuevo","ratingSource":"automatic","ratingConfidence":"initial"}"""
        )
        assertEquals("automatic", customer.ratingSource)
        assertEquals("initial", customer.ratingConfidence)
        val read = json.decodeFromString(
            CustomerRatingData.serializer(),
            """{"customerRating":{"score":5,"label":"Inicial · poca historia","rawRating":"nuevo","canRate":true,"automaticScore":5,"source":"automatic","manualUntil":null,"evaluatedAt":null,"confidence":"initial","explanation":"Nota inicial neutral de 5/10.","history":[{"id":"7","score":8,"previousScore":null,"reason":"Paga puntual","source":"manual","createdAt":"2026-10-13T14:00:00.000Z","createdBy":3},{"id":8,"score":null,"previousScore":8,"reason":"Reinicio","source":"automatic","createdAt":"2026-10-13T15:00:00.000Z","createdBy":4}]}}"""
        ).customerRating!!
        assertEquals(5, read.score)
        assertEquals("automatic", read.source)
        assertEquals("initial", read.confidence)
        assertEquals(null, read.evaluatedAt)
        assertEquals(null, com.backendcreditos.mobile.customerRatingContractError(read))
        assertEquals("automatic", read.history[1].source)
        assertEquals("nuevo", read.rawRating)
        assertTrue(read.canRate)
        assertEquals("7", read.history[0].id)
        assertEquals("8", read.history[1].id)
        assertEquals(8, read.history[1].previousScore)
        assertEquals(3, read.history[0].createdBy)
        val rated = json.decodeFromString(
            RateCustomerData.serializer(),
            """{"rateCustomer":{"score":9,"label":"Excelente","rawRating":"9","canRate":true,"automaticScore":6,"source":"manual","manualUntil":"2026-10-20T14:00:00.000Z","evaluatedAt":"2026-10-13T14:00:00.000Z","confidence":"limited","explanation":"Pagos con atrasos leves.","history":[]}}"""
        ).rateCustomer
        assertEquals(9, rated.score)
        assertEquals(6, rated.automaticScore)
        assertEquals("2026-10-20T14:00:00.000Z", rated.manualUntil)
        assertEquals(null, json.decodeFromString(CustomerRatingData.serializer(), """{"customerRating":null}""").customerRating)
    }

    @Test fun ratingResponseMissingAutomaticFieldsIsRejectedNotDefaulted() = runBlocking {
        val http = OkHttpClient.Builder().addInterceptor { chain ->
            Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(200).message("OK")
                .body("""{"data":{"customerRating":{"score":7,"label":"Bueno","rawRating":"7","canRate":true,"history":[]}}}""".toResponseBody())
                .build()
        }.build()
        val api = GraphQlApi(GraphQlClient("https://example.invalid/graphql", http))
        assertTrue(api.customerRating("token", "4", "10") is ApiResult.Rejected)
    }

    @Test fun rateCustomerSendsTrimmedReasonAndExpectedRatingAndValidatesLocally() = runBlocking {
        val bodies = mutableListOf<String>()
        val http = OkHttpClient.Builder().addInterceptor { chain ->
            val buffer = okio.Buffer()
            chain.request().body!!.writeTo(buffer)
            bodies += buffer.readUtf8()
            Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(200).message("OK")
                .body("""{"data":{"rateCustomer":{"score":4,"label":"Requiere seguimiento","rawRating":"4","canRate":true,"automaticScore":6,"source":"manual","manualUntil":"2026-10-20T14:00:00.000Z","evaluatedAt":"2026-10-13T14:00:00.000Z","confidence":"limited","explanation":"Pagos con atrasos leves.","history":[]}}}""".toResponseBody())
                .build()
        }.build()
        val api = GraphQlApi(GraphQlClient("https://example.invalid/graphql", http))
        val result = api.rateCustomer("token", "4", "10", 4, "  Atrasos repetidos  ", "nuevo")
        assertTrue(result is ApiResult.Success)
        val variables = json.parseToJsonElement(bodies.single()).let { it as kotlinx.serialization.json.JsonObject }["variables"].toString()
        assertEquals("""{"branchId":4,"customerId":10,"score":4,"reason":"Atrasos repetidos","expectedRating":"nuevo"}""", variables)
        assertTrue(api.rateCustomer("token", "4", "10", 11, "Atrasos repetidos", "4") is ApiResult.Rejected)
        assertTrue(api.rateCustomer("token", "4", "10", 5, " abc ", "4") is ApiResult.Rejected)
        assertTrue(api.rateCustomer("token", "4", "local-1", 5, "Atrasos repetidos", "4") is ApiResult.Rejected)
        assertEquals(1, bodies.size)
    }

    @Test fun staleExpectedRatingConflictIsReportedAsConflict() = runBlocking {
        val http = OkHttpClient.Builder().addInterceptor { chain ->
            Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(200).message("OK")
                .body("""{"errors":[{"message":"Rating changed","extensions":{"code":"CONFLICT"}}]}""".toResponseBody())
                .build()
        }.build()
        val result = GraphQlApi(GraphQlClient("https://example.invalid/graphql", http))
            .rateCustomer("token", "4", "10", 7, "Mejoró pagos", "5")
        assertTrue(result is ApiResult.Conflict)
    }

    @Test fun customerQueriesAndSyncDecodePhoneHistoryIncludingUnsendableLegacy() {
        for (document in listOf(GraphQlDocuments.PORTFOLIO, GraphQlDocuments.CUSTOMER_BY_ID, GraphQlDocuments.CUSTOMER_BY_DOCUMENT)) {
            assertTrue(document.contains("phones { id phone normalizedPhone whatsappOpenCount whatsappLastOpenedAt invalid validityChangedBy validityChangedAt }"))
        }
        val customer = json.decodeFromString(
            CustomerDto.serializer(),
            """{"id":1,"companyId":7,"personId":12,"firstName":"Test","lastName":"Fixture","phone":"573000000001","phones":[{"id":"10","phone":"3000000001","normalizedPhone":"573000000001","whatsappOpenCount":"9007199254740993","whatsappLastOpenedAt":"2026-10-02T12:00:00"},{"id":11,"phone":"300123 / 310123","normalizedPhone":null}]}"""
        )
        assertEquals(2, customer.phones.size)
        assertEquals("11", customer.phones[1].id)
        assertEquals(null, customer.phones[1].normalizedPhone)
        assertEquals("573000000001", customer.phone)
        assertEquals("9007199254740993", customer.phones[0].whatsappOpenCount)
        assertEquals("0", customer.phones[1].whatsappOpenCount)
    }

    @Test fun paymentRequiredResponseIsNotMistakenForMissingPermissions() = runBlocking {
        val http = OkHttpClient.Builder().addInterceptor { chain ->
            Response.Builder()
                .request(chain.request())
                .protocol(Protocol.HTTP_1_1)
                .code(403)
                .message("Forbidden")
                .body("""{"errors":[{"message":"Pago pendiente","extensions":{"code":"PAYMENT_REQUIRED"}}]}""".toResponseBody())
                .build()
        }.build()
        val result = GraphQlClient("https://example.invalid/graphql", http)
            .execute(GraphQlDocuments.ME, buildJsonObject { }, MeData.serializer(), "token")
        assertEquals(ApiResult.Rejected("Pago pendiente", "PAYMENT_REQUIRED"), result)
    }

    @Test fun loginUsesIntegerCompanyIdAndBackendAuthPayloadFields() {
        assertTrue(GraphQlDocuments.LOGIN.contains("companyId: Int!"))
        assertTrue(GraphQlDocuments.START_BIOMETRIC_LOGIN.contains("startBiometricLogin"))
        assertTrue(GraphQlDocuments.BIOMETRIC_LOGIN.contains("login: biometricLogin"))
        assertTrue(GraphQlDocuments.START_BIOMETRIC_REGISTRATION.contains("startBiometricRegistration"))
        assertTrue(GraphQlDocuments.FINISH_BIOMETRIC_REGISTRATION.contains("finishBiometricRegistration"))
        assertTrue(GraphQlDocuments.LOGIN.contains("token expiresIn paymentExpiresAt"))
        assertTrue(GraphQlDocuments.LOGIN.contains("user { userId companyId employeeId employeeMaxCredit isSuperAdministrator username firstName lastName companyName }"))
        assertTrue(GraphQlDocuments.LOGIN.contains("company { id name }"))
        val result = json.decodeFromString(
            LoginData.serializer(),
            """{"login":{"token":"opaque","expiresIn":3600,"paymentExpiresAt":1791763200000,"user":{"userId":3,"companyId":17,"employeeId":9,"employeeMaxCredit":150000,"isSuperAdministrator":false,"username":"operator","firstName":"A","lastName":"B","companyName":"Example"},"company":{"id":17,"name":"Example"},"branches":[{"id":4,"name":"North","type":"store","extraCharge":"boleta"}]}}"""
        ).login
        assertEquals(17, result.company.id)
        assertEquals(4, result.branches.single().id)
        assertEquals("boleta", result.branches.single().extraCharge)
        assertEquals(150000.0, result.user.employeeMaxCredit!!, 0.0)
        assertEquals(1791763200000.0, result.paymentExpiresAt!!, 0.0)
        assertFalse(result.user.isSuperAdministrator)
        val challenge = json.decodeFromString(
            StartBiometricLoginData.serializer(),
            """{"startBiometricLogin":{"challengeId":"abcd1234abcd1234abcd1234abcd1234","challenge":"Y2hhbGxlbmdl","expiresIn":300}}"""
        ).startBiometricLogin
        assertEquals(300, challenge.expiresIn)
        assertTrue(GraphQlDocuments.CUSTOMER_CANDIDATE.contains("personId customerId"))
        assertTrue(GraphQlDocuments.PERSON_DOCUMENT_TYPES.contains("personDocumentTypes"))
    }

    @Test fun receiptLinksUseAuthenticatedIssueAndRevokeMutations() {
        assertTrue(GraphQlDocuments.ISSUE_RECEIPT_LINK.contains("issueReceiptLink"))
        assertTrue(GraphQlDocuments.ISSUE_RECEIPT_LINK.contains("branchId: Int!"))
        assertTrue(GraphQlDocuments.ISSUE_RECEIPT_LINK.contains("kind: String!"))
        assertTrue(GraphQlDocuments.ISSUE_RECEIPT_LINK.contains("recordId: ID!"))
        assertTrue(GraphQlDocuments.ISSUE_RECEIPT_LINK.contains("format: String!"))
        assertTrue(GraphQlDocuments.REVOKE_RECEIPT_LINK.contains("revokeReceiptLink"))
        assertTrue(GraphQlDocuments.RECEIPT_LINKS.contains("receiptLinks"))
        assertTrue(GraphQlDocuments.RECEIPT_LINKS.contains("afterId: ID"))
        val issued = json.decodeFromString(
            IssueReceiptLinkData.serializer(),
            """{"issueReceiptLink":{"id":"42","url":"https://receipts.example/comprobante/opaque","expiresAt":"2026-11-01T12:00:00Z"}}"""
        ).issueReceiptLink
        assertEquals("42", issued.id)
        assertEquals("https://receipts.example/comprobante/opaque", issued.url)
        assertEquals("2026-11-01T12:00:00Z", issued.expiresAt)
        val revoked = json.decodeFromString(
            RevokeReceiptLinkData.serializer(), """{"revokeReceiptLink":true}"""
        )
        assertTrue(revoked.revokeReceiptLink)
        val links = json.decodeFromString(
            ReceiptLinksData.serializer(),
            """{"receiptLinks":{"receiptLinks":[{"id":"42","kind":"credit","receiptType":"Ticket","receiptSeries":"T-1","receiptNumber":"0042","format":"ticket","createdAt":"2026-10-02T12:00:00Z","expiresAt":"2026-11-01T12:00:00Z"}],"hasMore":false}}"""
        )
        assertEquals("0042", links.receiptLinks.receiptLinks.single().receiptNumber)
    }

    @Test fun portfolioIsCustomerNodesWithEmbeddedCreditsAndSchemaFields() {
        assertTrue(GraphQlDocuments.PORTFOLIO.contains("nodes {"))
        assertTrue(GraphQlDocuments.PORTFOLIO.contains("credits {"))
        assertTrue(GraphQlDocuments.PORTFOLIO.contains("sortOrder"))
        assertTrue(GraphQlDocuments.PORTFOLIO.contains("locations { id creditId name latitude longitude accuracy createdAt }"))
        assertTrue(GraphQlDocuments.PORTFOLIO.contains("comments { id customerId comment type userId createdAt updatedAt }"))
        assertFalse(GraphQlDocuments.PORTFOLIO.contains("items {"))
        val result = json.decodeFromString(
            PortfolioData.serializer(),
            """{"portfolio":{"nodes":[{"id":21,"companyId":17,"personId":31,"firstName":"A","lastName":"B","credits":[{"id":88,"companyId":17,"branchId":4,"customerId":21,"routeId":12,"principal":100.5,"balance":80,"sortOrder":1.5,"status":"active","locations":[{"id":"loc-1","creditId":"88","name":"Casa","latitude":4.7,"longitude":-74.0}]}],"comments":[]}],"snapshotCursor":"120","nextCursor":null,"hasNextPage":false}}"""
        ).portfolio
        assertEquals("88", result.nodes.single().credits.single().id)
        assertEquals(1.5, result.nodes.single().credits.single().sortOrder!!, 0.0)
        assertEquals("Casa", result.nodes.single().credits.single().locations.single().name)
    }

    @Test fun paymentSyncAndOperationDtosMatchSchemaFieldNames() {
        assertTrue(GraphQlDocuments.PAYMENT_HISTORY.contains("amount description state createdAt updatedAt routeId"))
        assertTrue(GraphQlDocuments.SYNC_CHANGES.contains("nodes { cursor recordType recordId action createdAt payload }"))
        assertTrue(GraphQlDocuments.APPLY_OFFLINE_OPERATION.contains("OfflineOperationInput!"))
        assertTrue(GraphQlDocuments.APPLY_OFFLINE_OPERATION.contains("operationId status entityId data eventCursor replayed"))
        assertFalse(GraphQlDocuments.SYNC_CHANGES.contains("entityType"))
        val payment = json.decodeFromString(
            PaymentHistoryData.serializer(),
            """{"paymentHistory":[{"id":30,"creditId":88,"amount":12.5,"description":"weekly","state":"paid","createdAt":"2026-01-01","updatedAt":"2026-01-01","routeId":12}]}"""
        ).paymentHistory.single()
        assertEquals("88", payment.creditId)
        assertEquals(12.5, payment.amount, 0.0)
        val sync = json.decodeFromString(
            SyncChangesData.serializer(),
            """{"syncChanges":{"nodes":[{"cursor":"121","recordType":"credit","recordId":"88","action":"UPDATE","createdAt":"2026-01-02","payload":{"status":"paid"}}]}}"""
        ).syncChanges.nodes.single()
        assertEquals("credit", sync.recordType)
        assertEquals("121", sync.cursor)
        val operation = json.decodeFromString(
            ApplyOfflineOperationData.serializer(),
            """{"applyOfflineOperation":{"operationId":"op","status":"APPLIED","entityId":"88","data":{"status":"paid"},"eventCursor":"122","replayed":false}}"""
        ).applyOfflineOperation
        assertEquals("122", operation.eventCursor)
        assertEquals("88", operation.entityId)
    }

    @Test fun graphQlIdAcceptsNumericAndStringRepresentations() {
        assertEquals("88", json.decodeFromString(GraphQlIdSerializer, "88"))
        assertEquals("88", json.decodeFromString(GraphQlIdSerializer, "\"88\""))
        try {
            json.decodeFromString(GraphQlIdSerializer, "true")
            throw AssertionError("Boolean was accepted as an ID.")
        } catch (_: SerializationException) {
            assertTrue(true)
        }
    }
}
