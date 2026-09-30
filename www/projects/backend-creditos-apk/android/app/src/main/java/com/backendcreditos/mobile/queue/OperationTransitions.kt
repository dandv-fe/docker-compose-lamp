package com.backendcreditos.mobile.queue

import com.backendcreditos.mobile.data.OperationKind
import com.backendcreditos.mobile.data.OperationStatus

object OperationTransitions {
    fun move(current: OperationStatus, next: OperationStatus): OperationStatus {
        val permitted = when (current) {
            OperationStatus.PENDING -> setOf(OperationStatus.IN_FLIGHT, OperationStatus.CONFLICT, OperationStatus.REJECTED)
            OperationStatus.IN_FLIGHT -> setOf(
                OperationStatus.PENDING, OperationStatus.CONFIRMED, OperationStatus.CONFLICT, OperationStatus.REJECTED
            )
            OperationStatus.CONFIRMED, OperationStatus.CONFLICT, OperationStatus.REJECTED -> emptySet()
        }
        require(next in permitted) { "Invalid operation status transition: $current -> $next" }
        return next
    }

    fun dependencyIsReady(status: OperationStatus?): Boolean = status == OperationStatus.CONFIRMED

    fun shouldRetry(result: RetryDecision): Boolean = result == RetryDecision.TRANSIENT_FAILURE

    fun canManuallyRetryRejectedCredit(kind: OperationKind, status: OperationStatus): Boolean =
        kind == OperationKind.CREATE_CREDIT && status == OperationStatus.REJECTED
}

enum class RetryDecision { ACKNOWLEDGED, AUTH_EXPIRED, PERMISSION_REJECTED, CONFLICT, REJECTED, TRANSIENT_FAILURE }
