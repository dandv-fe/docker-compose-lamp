package com.backendcreditos.mobile.data

import android.content.Context
import androidx.room.Room
import com.backendcreditos.mobile.security.LocalVault
import net.sqlcipher.database.SQLiteDatabase
import net.sqlcipher.database.SupportFactory

object DatabaseProvider {
    @Volatile private var instance: CreditDatabase? = null

    fun get(context: Context, vault: LocalVault): CreditDatabase =
        instance ?: synchronized(this) {
            SQLiteDatabase.loadLibs(context.applicationContext)
            instance ?: Room.databaseBuilder(
                context.applicationContext,
                CreditDatabase::class.java,
                "creditos-local.db"
            )
                .openHelperFactory(SupportFactory(vault.databaseKey()))
                .addMigrations(
                    CreditDatabase.MIGRATION_1_2,
                    CreditDatabase.MIGRATION_2_3,
                    CreditDatabase.MIGRATION_3_4,
                    CreditDatabase.MIGRATION_4_5,
                    CreditDatabase.MIGRATION_5_6,
                    CreditDatabase.MIGRATION_6_7,
                    CreditDatabase.MIGRATION_7_8,
                    CreditDatabase.MIGRATION_8_9,
                    CreditDatabase.MIGRATION_9_10,
                    CreditDatabase.MIGRATION_10_11
                )
                .build()
                .also { instance = it }
        }
}
