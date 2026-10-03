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
