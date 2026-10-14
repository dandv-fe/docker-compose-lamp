package com.backendcreditos.mobile.network

import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.*
import org.junit.Test

class CashBonusContractTest {
    @Test fun cashBonusHasRouteScopeAndSameTokenButNoDateOrOfflineOperation() = runBlocking {
        val bodies = mutableListOf<String>()
        val http = OkHttpClient.Builder().addInterceptor { chain ->
            val buffer = okio.Buffer()
            chain.request().body!!.writeTo(buffer)
            bodies += buffer.readUtf8()
            Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(200).message("OK")
                .body("""{"data":{"changeEmployeePayroll":{"ok":true,"id":"1","duplicate":false,"expenseId":"bonus_1","branchId":1,"routeId":2}}}""".toResponseBody()).build()
        }.build()
        val api = GraphQlApi(GraphQlClient("https://example.invalid/graphql", http))
        val context = CashBonusContext(1, 2, "created", listOf(CashBonusEmployee(3, "Ana")))
        repeat(2) {
            assertTrue(api.cashBonus("token", context, 3, "100", " motivo ", "1234567890123456") is ApiResult.Success)
        }
        assertEquals(bodies[0], bodies[1])
        val input = Json.parseToJsonElement(bodies[0]).jsonObject["variables"]!!.jsonObject["input"]!!.jsonObject
        assertEquals("1", input["branchId"].toString())
        assertEquals("2", input["routeId"].toString())
        assertEquals("\"motivo\"", input["reason"].toString())
        assertFalse(input.containsKey("date"))
        assertTrue(GraphQlDocuments.CASH_BONUS.contains("action: BONUS"))
        assertFalse(GraphQlDocuments.CASH_BONUS.contains("applyOfflineOperation"))
    }

    @Test fun bonusIsANewWriteAndNotExemptFromMobileVersionPolicy() = runBlocking {
        var requests = 0
        val http = OkHttpClient.Builder().addInterceptor { chain ->
            requests++
            Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(200).message("OK")
                .body("{}".toResponseBody()).build()
        }.build()
        val api = GraphQlApi(GraphQlClient("https://example.invalid/graphql", http) {
            throw IllegalArgumentException("Actualiza la APK")
        })
        val context = CashBonusContext(1, 2, "created", listOf(CashBonusEmployee(3, "Ana")))
        assertEquals(ApiResult.Rejected("Actualiza la APK", "APP_UPDATE_REQUIRED"),
            api.cashBonus("token", context, 3, "100", "motivo", "1234567890123456"))
        assertEquals(0, requests)
    }
}
