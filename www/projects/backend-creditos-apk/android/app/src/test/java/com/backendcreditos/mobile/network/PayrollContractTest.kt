package com.backendcreditos.mobile.network

import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.decodeFromString
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PayrollContractTest {
    @Test fun completeResponseKeepsAccruedSeparateFromFullPeriodAndReportsNoPlan() {
        val summary = Json.decodeFromString<MyPayrollData>(
            """{"myPayroll":{"employeeId":7,"asOf":"2026-09-10","periods":[{"contractId":null,"configured":false,"type":null,"frequency":"Mensual","startDate":"2026-09-01","endDate":"2026-09-30","baseAmount":0,"periodBaseAmount":0,"agreedBaseAmount":0,"capitalCommission":0,"collectionCommission":0,"commissionAmount":0,"bonusAmount":50,"earnedAmount":50,"paidAmount":20,"pendingAmount":30}],"totals":{"baseAmount":0,"periodBaseAmount":0,"capitalCommission":0,"collectionCommission":0,"commissionAmount":0,"bonusAmount":50,"earnedAmount":50,"paidAmount":20,"pendingAmount":30},"contracts":[],"vacations":[],"bonuses":[{"id":"1","date":"2026-09-10","amount":"50.00","reason":"Manual"}],"routes":[],"breakdown":[]}}"""
        ).myPayroll
        assertFalse(summary.periods.single().configured)
        assertEquals(30.0, summary.totals.pendingAmount, 0.0)
        assertEquals(null, com.backendcreditos.mobile.payrollContractError(summary))
    }
    @Test fun historyDecimalsAcceptDatabaseStringsAndNumbersButNeverInventZero() {
        val json = Json
        val contract = json.decodeFromString<PayrollContractDto>(
            """{"contractId":1,"effectiveDate":"2026-09-01","type":"Combinado","frequency":"Mensual","baseAmount":"3000.00","capitalRate":"2.5","collectionRate":3}"""
        )
        assertEquals(3000.0, contract.baseAmount, 0.0)
        assertEquals(2.5, contract.capitalRate, 0.0)
        assertEquals(3.0, contract.collectionRate, 0.0)
        val bonus = json.decodeFromString<PayrollBonusDto>(
            """{"id":"2","date":"2026-09-10","amount":"50.00","reason":"Bono manual"}"""
        )
        assertEquals(50.0, bonus.amount, 0.0)
        for (invalid in listOf("null", "\"abc\"", "\"NaN\"", "true", "{}")) {
            try {
                json.decodeFromString<PayrollBonusDto>(
                    """{"id":"2","date":"2026-09-10","amount":$invalid,"reason":"Bono"}"""
                )
                org.junit.Assert.fail("Debe rechazar $invalid")
            } catch (_: kotlinx.serialization.SerializationException) {
                // Contract errors are surfaced by GraphQlClient, not replaced with zero.
            }

        }
    }
    @Test fun routeAndMovementJsonDecodeTheirOwnSnapshotsAndSignedValues() {
        val route = Json.decodeFromString<PayrollRouteDto>(
            """{"routeId":8,"branchId":2,"branchName":"Centro","state":"entregando","provisional":true,"openedAt":"2026-09-01 08:00:00","contractId":null,"type":null,"weight":50,"capitalRate":0,"collectionRate":0,"mode":"Personalizado","capitalAmount":-100,"cashAmount":200,"capitalCommission":-1.25,"collectionCommission":3.75}"""
        )
        assertTrue(route.provisional)
        assertEquals(null, route.contractId)
        assertEquals(-1.25, route.capitalCommission, 0.0)
        assertEquals(-100.0, route.capitalAmount, 0.0)
        assertEquals(200.0, route.cashAmount, 0.0)
        assertEquals(3.75, route.collectionCommission, 0.0)
        val movement = Json.decodeFromString<PayrollMovementDto>(
            """{"routeId":8,"branchId":2,"branchName":"Centro","state":"entregando","provisional":true,"movementId":12,"movementDate":"2026-09-10","contractId":"1","type":"Porcentaje","weight":50,"capitalRate":2,"collectionRate":3,"mode":"Personalizado","capitalAmount":-100,"cashAmount":200,"excludedReason":"VACATION","capitalCommission":0,"collectionCommission":0}"""
        )
        assertEquals("12", movement.movementId)
        assertEquals(-100.0, movement.capitalAmount, 0.0)
        assertEquals("VACATION", movement.excludedReason)
    }
    @Test fun ownPayrollQueryHasNoInjectableEmployeeOrBranchAndNeverMutates() = runBlocking {
        var body = ""
        val http = OkHttpClient.Builder().addInterceptor { chain ->
            val buffer = okio.Buffer()
            chain.request().body!!.writeTo(buffer)
            body = buffer.readUtf8()
            Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(200).message("OK")
                .body("""{"data":{"myPayroll":null}}""".toResponseBody()).build()
        }.build()
        val api = GraphQlApi(GraphQlClient("https://example.invalid/graphql", http))
        assertTrue(api.myPayroll("token") is ApiResult.Rejected)
        assertEquals("{}", Json.parseToJsonElement(body).jsonObject["variables"].toString())
        assertTrue(GraphQlDocuments.MY_PAYROLL.trimStart().startsWith("query MyPayroll"))
        assertFalse(GraphQlDocuments.MY_PAYROLL.contains("\$employeeId"))
        assertFalse(GraphQlDocuments.MY_PAYROLL.contains("\$branchId"))
        assertFalse(GraphQlDocuments.MY_PAYROLL.contains("mutation"))
        for (field in listOf("configured", "type", "frequency", "baseAmount", "periodBaseAmount", "agreedBaseAmount", "capitalCommission",
                "collectionCommission", "earnedAmount", "paidAmount", "pendingAmount", "contracts", "vacations", "bonuses", "routes", "breakdown")) {
            assertTrue(GraphQlDocuments.MY_PAYROLL.contains(field))
        }
    }

    @Test fun incompleteSummaryIsAnExplicitErrorNotASuccessWithDefaultZero() = runBlocking {
        val http = OkHttpClient.Builder().addInterceptor { chain ->
            Response.Builder().request(chain.request()).protocol(Protocol.HTTP_1_1).code(200).message("OK")
                .body("""{"data":{"myPayroll":{"employeeId":7,"asOf":"2026-10-10","periods":[]}}}""".toResponseBody()).build()
        }.build()
        assertTrue(GraphQlApi(GraphQlClient("https://example.invalid/graphql", http)).myPayroll("token") is ApiResult.Rejected)
    }
}
