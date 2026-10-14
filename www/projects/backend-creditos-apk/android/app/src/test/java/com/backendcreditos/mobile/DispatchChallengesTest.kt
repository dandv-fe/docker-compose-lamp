package com.backendcreditos.mobile

import com.backendcreditos.mobile.network.*
import org.junit.Assert.*
import org.junit.Test

internal fun challengeFixture() = DispatchChallengeDto(
    "challenge-1", 12, 2, "Centro", "created", true, "active", "2026-10-10", "2026-10-20",
    "Mejora tu avance", 10.0, 1000.0, 2000.0,
    PayrollPeriodDto("1", true, "Combinado", "Mensual", "2026-10-01", "2026-10-31",
        100.0, 310.0, 310.0, 30.0, 40.0, 70.0, 0.0, 100.0, 20.0, 80.0),
    ChallengeAllocationDto(50.0, 2.0, 3.0),
    ChallengeGoalDto(110.0, 40.0, 30.0, 40.0, 1000.0, null, 130.0, 130.0, 30.0, 30.0),
    ChallengeProgressDto(100.0, 200.0, 500.0, 1000.0, 20.0, 20.0, 70.0, 110.0, 63.636, false),
    ChallengeForecastDto(true, "available",
        ChallengeCollectionsDto(true, "available", 100.0, 30.0, 20.0, 5, 0, emptyList(), emptyList()),
        listOf("Invitación, no garantía de ingresos."))
)

class DispatchChallengesTest {
    private fun root(item: DispatchChallengeDto = challengeFixture()) =
        DispatchChallengesDto(7, "2026-10-13", listOf(item))

    @Test fun validatesBoundariesSignedAndAboveHundredPercentWithoutLocalMath() {
        assertNull(dispatchChallengesError(root()))
        for (increment in listOf(0.1, 40.0)) assertNull(dispatchChallengesError(root(
            challengeFixture().copy(incrementPercent = increment))))
        val item = challengeFixture()
        assertNull(dispatchChallengesError(root(item.copy(progress = item.progress.copy(
            creditedCapital = -50.0, capitalPercent = -10.0, collectionPercent = 140.0)))))
        assertNull(dispatchChallengesError(DispatchChallengesDto(7, "2026-10-13", emptyList())))
        assertNotNull(dispatchChallengesError(root(item.copy(incrementPercent = 0.09))))
        assertNotNull(dispatchChallengesError(root(item.copy(incrementPercent = 40.01))))
    }

    @Test fun missingRatesAndNoSalaryAreExplicitlyNotComputableNotZeroSuccess() {
        val item = challengeFixture()
        val insufficient = item.copy(
            salary = item.salary.copy(configured = false, contractId = null, type = null),
            allocation = ChallengeAllocationDto(0.0, 0.0, 0.0),
            goal = item.goal.copy(capitalRequired = null, collectionRequired = null, surplusPercent = null),
            progress = item.progress.copy(capitalTarget = 0.0, collectionTarget = 0.0,
                capitalPercent = null, collectionPercent = null),
            forecast = item.forecast.copy(status = "insufficient_data", collections = null))
        assertNull(dispatchChallengesError(root(insufficient)))
        assertTrue(challengeForecastText(insufficient).contains("No se puede estimar"))
        assertNotNull(dispatchChallengesError(root(insufficient.copy(forecast = insufficient.forecast.copy(status = "available")))))
    }

    @Test fun malformedNumbersStatesDatesAndDuplicateIdsAreRejected() {
        val item = challengeFixture()
        val badItems = listOf(
            item.copy(capitalGoal = Double.NaN), item.copy(status = "won"), item.copy(deadline = "2026-02-30"),
            item.copy(allocation = item.allocation.copy(capitalRate = Double.POSITIVE_INFINITY)),
            item.copy(progress = item.progress.copy(capitalPercent = null)),
            item.copy(goal = item.goal.copy(surplusPercent = Double.NaN)),
            item.copy(forecast = item.forecast.copy(estimated = false)),
            item.copy(forecast = item.forecast.copy(collections = item.forecast.collections!!.copy(invalidCardCount = 6)))
        )
        badItems.forEach { assertNotNull(dispatchChallengesError(root(it))) }
        assertNotNull(dispatchChallengesError(root().copy(items = listOf(item, item))))
        assertNotNull(dispatchChallengesError(root().copy(employeeId = 0)))
    }

    @Test fun achievementNeverPromisesMoneyAndOpenOrExpiredRoutesRemainQualified() {
        val item = challengeFixture().copy(progress = challengeFixture().progress.copy(achieved = true))
        assertTrue(challengeAchievementText(item).contains("provisional"))
        assertTrue(challengeAchievementText(item.copy(routeState = "entregando")).contains("provisional"))
        assertTrue(challengeAchievementText(item.copy(routeState = "saved")).contains("No confirma un pago"))
        for (status in listOf("expired", "closed", "unassigned")) {
            val ended = item.copy(status = status, forecast = item.forecast.copy(status = "not_applicable", collections = null))
            assertNull(dispatchChallengesError(root(ended)))
            assertTrue(challengeForecastText(ended).contains("Sin proyección vigente"))
        }
    }

    @Test fun revisionTracksInvitationButNeverLiveAdvanceOrToday() {
        val item = challengeFixture()
        assertEquals(challengePresentationKey(item), challengePresentationKey(item.copy(
            progress = item.progress.copy(commissionAmount = 500.0, achieved = true), status = "closed")))
        assertNotEquals(challengePresentationKey(item), challengePresentationKey(item.copy(description = "Nueva invitación")))
        assertNotEquals(challengePresentationKey(item), challengePresentationKey(item.copy(deadline = "2026-10-21")))
        assertNotEquals(challengePresentationKey(item), challengePresentationKey(item.copy(incrementPercent = 20.0)))
    }
}
