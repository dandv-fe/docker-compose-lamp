package com.backendcreditos.mobile.queue

import com.backendcreditos.mobile.data.OperationStatus
import com.backendcreditos.mobile.data.OfflineOperationEntity
import com.backendcreditos.mobile.data.OperationKind
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class OperationTransitionsTest {
    @Test fun onlyInFlightOperationsCanBeConfirmed() {
        assertEquals(
            OperationStatus.CONFIRMED,
            OperationTransitions.move(OperationStatus.IN_FLIGHT, OperationStatus.CONFIRMED)
        )
        assertThrows(IllegalArgumentException::class.java) {
            OperationTransitions.move(OperationStatus.PENDING, OperationStatus.CONFIRMED)
        }
        assertThrows(IllegalArgumentException::class.java) {
            OperationTransitions.move(OperationStatus.CONFIRMED, OperationStatus.PENDING)
        }
    }

    @Test fun dependencyMustBeServerConfirmed() {
        assertTrue(OperationTransitions.dependencyIsReady(OperationStatus.CONFIRMED))
        assertFalse(OperationTransitions.dependencyIsReady(OperationStatus.PENDING))
        assertFalse(OperationTransitions.dependencyIsReady(OperationStatus.CONFLICT))
        assertFalse(OperationTransitions.dependencyIsReady(null))
    }

    @Test fun onlyTransientErrorsRetry() {
        assertTrue(OperationTransitions.shouldRetry(RetryDecision.TRANSIENT_FAILURE))
        assertFalse(OperationTransitions.shouldRetry(RetryDecision.AUTH_EXPIRED))
        assertFalse(OperationTransitions.shouldRetry(RetryDecision.PERMISSION_REJECTED))
        assertFalse(OperationTransitions.shouldRetry(RetryDecision.CONFLICT))
        assertFalse(OperationTransitions.shouldRetry(RetryDecision.REJECTED))
    }

    @Test fun transientRetryKeepsTheSameIdempotencyKeyAndAccountBinding() {
        val queued = OfflineOperationEntity(
            operationId = "stable-operation-key",
            accountKey = "opaque-account-scope",
            companyId = "opaque-company-scope",
            branchId = "opaque-branch-scope",
            kind = OperationKind.UPDATE_CREDIT,
            entityId = "opaque-entity-key",
            baseVersion = "v1",
            payload = "{}",
            dependsOnOperationId = null,
            status = OperationStatus.PENDING,
            attempts = 0,
            lastError = null,
            serverState = null,
            createdAt = 1L
        )
        val inFlight = queued.copy(
            status = OperationTransitions.move(queued.status, OperationStatus.IN_FLIGHT),
            attempts = queued.attempts + 1
        )
        val retry = inFlight.copy(
            status = OperationTransitions.move(inFlight.status, OperationStatus.PENDING),
            lastError = "Temporary network failure"
        )
        assertEquals(queued.operationId, retry.operationId)
        assertEquals(queued.accountKey, retry.accountKey)
        assertEquals(queued.branchId, retry.branchId)
        assertEquals(1, retry.attempts)
        assertTrue(OperationTransitions.shouldRetry(RetryDecision.TRANSIENT_FAILURE))
    }
}
