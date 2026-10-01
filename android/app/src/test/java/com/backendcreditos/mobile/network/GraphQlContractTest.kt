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
        assertTrue(GraphQlDocuments.CUSTOMER_CANDIDATE.contains("personId customerId"))
        assertTrue(GraphQlDocuments.PERSON_DOCUMENT_TYPES.contains("personDocumentTypes"))
    }

    @Test fun portfolioIsCustomerNodesWithEmbeddedCreditsAndSchemaFields() {
        assertTrue(GraphQlDocuments.PORTFOLIO.contains("nodes {"))
        assertTrue(GraphQlDocuments.PORTFOLIO.contains("credits {"))
        assertTrue(GraphQlDocuments.PORTFOLIO.contains("sortOrder"))
        assertTrue(GraphQlDocuments.PORTFOLIO.contains("comments { id customerId comment type userId createdAt updatedAt }"))
        assertFalse(GraphQlDocuments.PORTFOLIO.contains("items {"))
        val result = json.decodeFromString(
            PortfolioData.serializer(),
            """{"portfolio":{"nodes":[{"id":21,"companyId":17,"personId":31,"firstName":"A","lastName":"B","credits":[{"id":88,"companyId":17,"branchId":4,"customerId":21,"routeId":12,"principal":100.5,"balance":80,"sortOrder":1.5,"status":"active"}],"comments":[]}],"snapshotCursor":"120","nextCursor":null,"hasNextPage":false}}"""
        ).portfolio
        assertEquals("88", result.nodes.single().credits.single().id)
        assertEquals(1.5, result.nodes.single().credits.single().sortOrder!!, 0.0)
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
