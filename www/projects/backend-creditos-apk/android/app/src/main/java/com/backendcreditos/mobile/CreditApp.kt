package com.backendcreditos.mobile

import android.app.Application
import com.backendcreditos.mobile.data.CreditRepository
import com.backendcreditos.mobile.data.DatabaseProvider
import com.backendcreditos.mobile.network.GraphQlApi
import com.backendcreditos.mobile.network.GraphQlClient
import com.backendcreditos.mobile.network.ServerConnectionSettings
import com.backendcreditos.mobile.security.LocalVault
import com.backendcreditos.mobile.work.SyncScheduler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class CreditApp : Application() {
    lateinit var vault: LocalVault
        private set
    lateinit var database: com.backendcreditos.mobile.data.CreditDatabase
        private set
    lateinit var api: GraphQlApi
        private set
    lateinit var connectionSettings: ServerConnectionSettings
        private set
    lateinit var repository: CreditRepository
        private set

    override fun onCreate() {
        super.onCreate()
        vault = LocalVault(this)
        database = DatabaseProvider.get(this, vault)
        connectionSettings = ServerConnectionSettings(this)
        api = GraphQlApi(GraphQlClient(connectionSettings.endpoint()))
        repository = CreditRepository(database, api)
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            vault.readSession()?.let { session ->
                if (!repository.syncIsPaused(session.accountKey)) {
                    database.localDao().pendingBranches(session.accountKey, session.companyId).forEach { branchId ->
                        SyncScheduler.enqueue(this@CreditApp, session.accountKey, branchId)
                    }
                }
            }
        }
    }

    fun configureGraphQlEndpoint(rawValue: String): String {
        val endpoint = connectionSettings.save(rawValue)
        api = GraphQlApi(GraphQlClient(endpoint))
        repository = CreditRepository(database, api)
        return endpoint
    }
}
