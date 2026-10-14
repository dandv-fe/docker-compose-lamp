package com.backendcreditos.mobile.network

import com.backendcreditos.mobile.challengeFixture
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.*
import org.junit.Test

class DispatchChallengesContractTest {
    private fun client(body: String, inspect: (String) -> Unit = {}): GraphQlApi {
        val http = OkHttpClient.Builder().addInterceptor { chain ->
            val buffer = okio.Buffer()
            chain.request().body!!.writeTo(buffer)
            inspect(buffer.readUtf8())
            Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(200).message("OK")
                .body(body.toResponseBody()).build()
        }.build()
        return GraphQlApi(GraphQlClient("https://example.invalid/graphql", http) {
            throw IllegalArgumentException("Las escrituras nuevas están bloqueadas")
        })
    }

    @Test fun queryIsOwnOnlyNoArgumentsAndReadAllowedByVersionGate() = runBlocking {
        val payload = Json.encodeToString(DispatchChallengesData(
            DispatchChallengesDto(7, "2026-10-13", listOf(challengeFixture()))))
        val api = client("""{"data":$payload}""") { body ->
            val request = Json.parseToJsonElement(body).jsonObject
            assertEquals("{}", request["variables"].toString())
        }
        val result = api.myDispatchChallenges("token")
        assertTrue(result is ApiResult.Success)
        assertEquals("challenge-1", (result as ApiResult.Success).value.myDispatchChallenges.items.single().challengeId)
        val document = GraphQlDocuments.MY_DISPATCH_CHALLENGES
        assertTrue(document.trimStart().startsWith("query"))
        assertFalse(document.contains("$"))
        assertFalse(document.contains("mutation"))
        assertFalse(document.contains("employeeId"))
        assertFalse(document.contains("branchId"))
        assertFalse(document.contains("asOf"))
    }

    @Test fun missingRequiredNumbersOrForecastAreRejectedNotFilledWithZero() = runBlocking {
        val item = Json.encodeToJsonElement(challengeFixture()).jsonObject
        val broken = listOf(
            JsonObject(item - "progress"),
            JsonObject(item + ("incrementPercent" to JsonPrimitive("abc"))),
            JsonObject(item + ("goal" to JsonObject(item["goal"]!!.jsonObject - "targetCommission"))),
            JsonObject(item + ("forecast" to JsonNull))
        )
        for (bad in broken) {
            val root = buildJsonObject {
                put("employeeId", 7); put("asOf", "2026-10-13"); put("items", JsonArray(listOf(bad)))
            }
            assertTrue(client("""{"data":{"myDispatchChallenges":$root}}""").myDispatchChallenges("token") is ApiResult.Rejected)
        }
        assertTrue(client("""{"data":{"myDispatchChallenges":null}}""").myDispatchChallenges("token") is ApiResult.Rejected)
    }
}
