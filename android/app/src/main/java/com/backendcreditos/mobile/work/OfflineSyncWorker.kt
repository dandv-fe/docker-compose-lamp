package com.backendcreditos.mobile.work

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import androidx.work.Data
import com.backendcreditos.mobile.CreditApp
import com.backendcreditos.mobile.data.OperationStatus
import com.backendcreditos.mobile.network.ApiResult
import com.backendcreditos.mobile.queue.OperationTransitions
import com.backendcreditos.mobile.queue.RouteGuard

class OfflineSyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val accountKey = inputData.getString(KEY_ACCOUNT) ?: return Result.failure()
        val app = applicationContext as CreditApp
        val session = app.vault.readSession() ?: return Result.success()
        if (session.accountKey != accountKey) return Result.success()
        val repo = app.repository
        app.database.localDao().recoverInFlightOperations(accountKey)
        if (repo.syncIsPaused(accountKey)) return Result.success()
        val requestedBranchId = inputData.getString(KEY_BRANCH)
        val expectedCursor = inputData.getString(KEY_EXPECTED_CURSOR)
        if (expectedCursor != null && requestedBranchId != null) {
            val syncResult = syncChanges(app, session, requestedBranchId, expectedCursor)
            if (syncResult !is Result.Success) return syncResult
            if (repo.syncIsPaused(accountKey)) return Result.success()
        }
        val operation = app.database.localDao().nextRunnable(accountKey, session.companyId)
        if (operation == null) {
            val branchId = requestedBranchId ?: session.selectedBranchId ?: return Result.success()
            return syncChanges(app, session, branchId)
        }
        if (app.database.localDao().claimOperation(operation.operationId) == 0) return Result.retry()

        return when (val response = app.api.applyOfflineOperation(session.token, repo.operationInput(operation))) {
            is ApiResult.Success -> {
                val result = response.value.applyOfflineOperation
                val serverState = repo.serverStateForStorage(operation, result.data, result.entityId)
                if (result.operationId != operation.operationId) {
                    app.database.localDao().finishOperation(
                        operation.operationId, OperationStatus.REJECTED,
                        "El servidor devolvió un identificador de operación distinto.", serverState
                    )
                    repo.setSyncPaused(accountKey, "PROTOCOL")
                    Result.success()
                } else {
                    when (result.status.uppercase()) {
                        "CONFIRMED", "APPLIED", "SUCCESS", "COMPLETED" -> {
                            OperationTransitions.move(OperationStatus.IN_FLIGHT, OperationStatus.CONFIRMED)
                            app.database.localDao().finishOperation(
                                operation.operationId, OperationStatus.CONFIRMED, null, serverState
                            )
                            app.repository.applyServerAcknowledgement(operation, serverState, result.entityId)
                            val syncResult = syncChanges(app, session, operation.branchId, result.eventCursor)
                            if (syncResult !is Result.Success) {
                                SyncScheduler.enqueue(applicationContext, accountKey, operation.branchId, result.eventCursor)
                                return Result.success()
                            }
                            SyncScheduler.enqueue(applicationContext, accountKey, operation.branchId)
                            Result.success()
                        }
                        "CONFLICT" -> {
                            OperationTransitions.move(OperationStatus.IN_FLIGHT, OperationStatus.CONFLICT)
                            app.database.localDao().finishOperation(
                                operation.operationId, OperationStatus.CONFLICT,
                                "El servidor devolvió un conflicto para esta operación.", serverState
                            )
                            repo.setSyncPaused(accountKey, "CONFLICT")
                            Result.success()
                        }
                        "REJECTED" -> {
                            OperationTransitions.move(OperationStatus.IN_FLIGHT, OperationStatus.REJECTED)
                            app.database.localDao().finishOperation(
                                operation.operationId, OperationStatus.REJECTED,
                                "El servidor rechazó esta operación.", serverState
                            )
                            repo.setSyncPaused(accountKey, "REJECTED")
                            Result.success()
                        }
                        else -> {
                            OperationTransitions.move(OperationStatus.IN_FLIGHT, OperationStatus.REJECTED)
                            app.database.localDao().finishOperation(
                                operation.operationId, OperationStatus.REJECTED,
                                "Estado de operación desconocido del servidor: ${result.status}", serverState
                            )
                            repo.setSyncPaused(accountKey, "PROTOCOL")
                            Result.success()
                        }
                    }
                }
            }
            is ApiResult.AuthExpired -> {
                app.database.localDao().returnToPending(operation.operationId, response.message)
                repo.setSyncPaused(accountKey, "AUTH")
                Result.success()
            }
            is ApiResult.PermissionRejected -> {
                OperationTransitions.move(OperationStatus.IN_FLIGHT, OperationStatus.REJECTED)
                app.database.localDao().finishOperation(operation.operationId, OperationStatus.REJECTED, response.message, null)
                repo.setSyncPaused(accountKey, "PERMISSION")
                Result.success()
            }
            is ApiResult.Conflict -> {
                OperationTransitions.move(OperationStatus.IN_FLIGHT, OperationStatus.CONFLICT)
                val state = response.currentRecord?.let {
                    repo.serverStateForStorage(operation, it, operation.entityId)
                }
                app.database.localDao().finishOperation(
                    operation.operationId, OperationStatus.CONFLICT, response.message, state
                )
                repo.setSyncPaused(accountKey, "CONFLICT")
                Result.success()
            }
            is ApiResult.Rejected -> {
                OperationTransitions.move(OperationStatus.IN_FLIGHT, OperationStatus.REJECTED)
                if (RouteGuard.isRouteRefusal(response.code)) {
                    // The queue is never swept on its own: the record stays in the Cola screen with
                    // its reason so the person can read it and decide to resend it or remove it.
                    app.database.localDao().finishRefusedOperation(
                        operation.operationId, OperationStatus.REJECTED, response.message, response.code!!
                    )
                    repo.setSyncPaused(accountKey, "ROUTE")
                    return Result.success()
                }
                app.database.localDao().finishOperation(operation.operationId, OperationStatus.REJECTED, response.message, null)
                repo.setSyncPaused(accountKey, "REJECTED")
                Result.success()
            }
            is ApiResult.Retryable -> {
                app.database.localDao().returnToPending(operation.operationId, response.message)
                Result.retry()
            }
        }
    }

    private suspend fun syncChanges(
        app: CreditApp,
        session: com.backendcreditos.mobile.security.StoredSession,
        branchId: String,
        expectedCursor: String? = null
    ): Result {
        return when (val response = app.repository.pullChanges(session, branchId)) {
            is ApiResult.Success -> {
                val actual = response.value
                if (expectedCursor != null && !cursorReached(actual, expectedCursor)) {
                    Result.retry()
                } else {
                    Result.success()
                }
            }
            is ApiResult.AuthExpired -> {
                app.repository.setSyncPaused(session.accountKey, "AUTH")
                Result.success()
            }
            is ApiResult.Conflict -> {
                app.repository.setSyncPaused(session.accountKey, "SYNC_CONFLICT")
                Result.success()
            }
            is ApiResult.PermissionRejected -> {
                app.repository.setSyncPaused(session.accountKey, "PERMISSION")
                Result.success()
            }
            is ApiResult.Rejected -> {
                app.repository.setSyncPaused(session.accountKey, "SYNC_PROTOCOL")
                Result.success()
            }
            is ApiResult.Retryable -> Result.retry()
        }
    }

    private fun cursorReached(actual: String?, expected: String): Boolean {
        if (actual == null) return false
        val actualNumber = actual.toBigIntegerOrNull()
        val expectedNumber = expected.toBigIntegerOrNull()
        return if (actualNumber != null && expectedNumber != null) actualNumber >= expectedNumber
        else actual == expected
    }

    companion object {
        private const val KEY_ACCOUNT = "accountKey"
        private const val KEY_BRANCH = "branchId"
        private const val KEY_EXPECTED_CURSOR = "expectedCursor"
        fun input(accountKey: String, branchId: String? = null, expectedCursor: String? = null): Data =
            Data.Builder()
                .putString(KEY_ACCOUNT, accountKey)
                .putString(KEY_BRANCH, branchId)
                .putString(KEY_EXPECTED_CURSOR, expectedCursor)
                .build()
    }
}
