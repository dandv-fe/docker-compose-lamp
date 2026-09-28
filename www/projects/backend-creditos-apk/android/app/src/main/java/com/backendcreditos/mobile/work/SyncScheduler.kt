package com.backendcreditos.mobile.work

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.OutOfQuotaPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

object SyncScheduler {
    private const val PREFS_NAME = "sync_scheduler_prefs"
    private const val KEY_INTERVAL_MINUTES = "interval_minutes"

    // The user asked for a shorter cadence, but PeriodicWorkRequest enforces a 15-minute
    // floor at the OS level; a faster interval would require a persistent foreground
    // service, which was explicitly rejected. Default falls in the requested 20-30 min range.
    const val MIN_INTERVAL_MINUTES = 15L
    const val DEFAULT_INTERVAL_MINUTES = 30L

    /**
     * Enqueues the sync worker. When [expedited] is true (the device is online and the
     * caller wants the operation sent to the server immediately, e.g. right after
     * registering an abono/payment), the request is submitted with high priority so
     * WorkManager runs it right away instead of applying its normal scheduling delay.
     * The underlying queue/idempotency semantics are unchanged either way.
     */
    fun enqueue(
        context: Context,
        accountKey: String,
        branchId: String? = null,
        expectedCursor: String? = null,
        expedited: Boolean = false
    ) {
        val builder = OneTimeWorkRequestBuilder<OfflineSyncWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setInputData(OfflineSyncWorker.input(accountKey, branchId, expectedCursor))
            .addTag("credit-sync-account-$accountKey")
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
        if (expedited) {
            builder.setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
        }
        WorkManager.getInstance(context).enqueueUniqueWork(
            workName(accountKey), ExistingWorkPolicy.APPEND_OR_REPLACE, builder.build()
        )
    }

    fun workName(accountKey: String): String = "credit-sync-$accountKey"

    fun periodicWorkName(accountKey: String): String = "credit-sync-periodic-$accountKey"

    fun readIntervalMinutes(context: Context): Long =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getLong(KEY_INTERVAL_MINUTES, DEFAULT_INTERVAL_MINUTES)

    /**
     * (Re)schedules the periodic background sync for [accountKey]/[branchId] at
     * [intervalMinutes], persisting the chosen interval so it survives process restarts.
     * Values below [MIN_INTERVAL_MINUTES] are clamped, since WorkManager silently does
     * the same internally.
     */
    fun schedulePeriodic(
        context: Context,
        accountKey: String,
        branchId: String,
        intervalMinutes: Long = readIntervalMinutes(context)
    ) {
        val effectiveMinutes = intervalMinutes.coerceAtLeast(MIN_INTERVAL_MINUTES)
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
            .putLong(KEY_INTERVAL_MINUTES, effectiveMinutes)
            .apply()
        val request = PeriodicWorkRequestBuilder<OfflineSyncWorker>(effectiveMinutes, TimeUnit.MINUTES)
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setInputData(OfflineSyncWorker.input(accountKey, branchId, null))
            .addTag("credit-sync-account-$accountKey")
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            periodicWorkName(accountKey), ExistingPeriodicWorkPolicy.UPDATE, request
        )
    }

    fun cancelPeriodic(context: Context, accountKey: String) {
        WorkManager.getInstance(context).cancelUniqueWork(periodicWorkName(accountKey))
    }
}
