package com.backendcreditos.mobile.data

import androidx.room.Dao
import androidx.room.Database
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.RoomDatabase
import androidx.room.Transaction
import androidx.room.TypeConverter
import androidx.room.TypeConverters
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

class DatabaseConverters {
    @TypeConverter fun operationKind(value: String): OperationKind = OperationKind.valueOf(value)
    @TypeConverter fun operationKind(value: OperationKind): String = value.name
    @TypeConverter fun operationStatus(value: String): OperationStatus = OperationStatus.valueOf(value)
    @TypeConverter fun operationStatus(value: OperationStatus): String = value.name
}

@Dao
interface LocalDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun putCustomers(items: List<CustomerEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun putCredits(items: List<CreditEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun putPayments(items: List<PaymentEntity>)

    @Query("SELECT * FROM customers WHERE accountKey = :accountKey AND branchId = :branchId AND (firstName || ' ' || lastName LIKE '%' || :query || '%' OR documentNumber LIKE '%' || :query || '%') ORDER BY lastName, firstName LIMIT 100")
    suspend fun searchCustomers(accountKey: String, branchId: String, query: String): List<CustomerEntity>

    @Query("SELECT * FROM customers WHERE accountKey = :accountKey AND branchId = :branchId AND id = :id LIMIT 1")
    suspend fun customer(accountKey: String, branchId: String, id: String): CustomerEntity?

    @Query("SELECT * FROM customers WHERE accountKey = :accountKey AND branchId = :branchId")
    suspend fun customersForBranch(accountKey: String, branchId: String): List<CustomerEntity>

    @Query("DELETE FROM customers WHERE accountKey = :accountKey AND branchId = :branchId AND id = :id")
    suspend fun deleteCustomer(accountKey: String, branchId: String, id: String)

    @Query("DELETE FROM credits WHERE accountKey = :accountKey AND branchId = :branchId AND customerId = :customerId")
    suspend fun deleteCreditsForCustomer(accountKey: String, branchId: String, customerId: String)


    @Query("SELECT * FROM credits WHERE accountKey = :accountKey AND branchId = :branchId ORDER BY sortOrder, id")
    suspend fun portfolio(accountKey: String, branchId: String): List<CreditEntity>

    @Query("SELECT * FROM credits WHERE accountKey = :accountKey AND branchId = :branchId AND id = :id LIMIT 1")
    suspend fun credit(accountKey: String, branchId: String, id: String): CreditEntity?

    // Mirrors model/Cartera.php::listRuta(): hides credits in these statuses from the
    // main cartera list (a separate legacy screen exists for cancelled cards). Used only
    // for the visible list; sync/reconciliation code keeps using portfolio() above so it
    // still sees every locally cached credit regardless of status.
    @Query(
        "SELECT * FROM credits WHERE accountKey = :accountKey AND branchId = :branchId " +
            "AND status NOT IN ('cancelado','inactiva','moroso','fallecio','discapacitado') " +
            "ORDER BY sortOrder, id"
    )
    suspend fun visiblePortfolio(accountKey: String, branchId: String): List<CreditEntity>

    @Query("SELECT * FROM payments WHERE accountKey = :accountKey AND branchId = :branchId AND creditId = :creditId ORDER BY createdAt DESC")
    suspend fun payments(accountKey: String, branchId: String, creditId: String): List<PaymentEntity>

    @Query("SELECT * FROM payments WHERE accountKey = :accountKey AND branchId = :branchId ORDER BY createdAt DESC")
    suspend fun paymentsForBranch(accountKey: String, branchId: String): List<PaymentEntity>

    @Query("SELECT * FROM payments WHERE accountKey = :accountKey AND branchId = :branchId AND id = :id LIMIT 1")
    suspend fun payment(accountKey: String, branchId: String, id: String): PaymentEntity?

    @Query("DELETE FROM credits WHERE accountKey = :accountKey AND branchId = :branchId AND id = :id")
    suspend fun deleteCredit(accountKey: String, branchId: String, id: String)

    @Query("UPDATE credits SET customerId = :newCustomerId WHERE accountKey = :accountKey AND branchId = :branchId AND customerId = :oldCustomerId")
    suspend fun remapCreditCustomerId(accountKey: String, branchId: String, oldCustomerId: String, newCustomerId: String)

    @Query("DELETE FROM payments WHERE accountKey = :accountKey AND branchId = :branchId AND id = :id")
    suspend fun deletePayment(accountKey: String, branchId: String, id: String)

    @Query("DELETE FROM payments WHERE accountKey = :accountKey AND branchId = :branchId AND creditId = :creditId")
    suspend fun deletePaymentsForCredit(accountKey: String, branchId: String, creditId: String)

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun addOperation(operation: OfflineOperationEntity)

    @Query("SELECT * FROM offline_operations o WHERE o.accountKey = :accountKey AND o.companyId = :companyId AND o.status = 'PENDING' AND (o.dependsOnOperationId IS NULL OR EXISTS (SELECT 1 FROM offline_operations d WHERE d.operationId = o.dependsOnOperationId AND d.status = 'CONFIRMED')) ORDER BY o.createdAt LIMIT 1")
    suspend fun nextRunnable(accountKey: String, companyId: String): OfflineOperationEntity?

    @Query("SELECT * FROM offline_operations WHERE operationId = :operationId LIMIT 1")
    suspend fun operation(operationId: String): OfflineOperationEntity?

    @Query("SELECT * FROM offline_operations WHERE operationId IN (:operationIds)")
    suspend fun operationsByIds(operationIds: List<String>): List<OfflineOperationEntity>

    @Query("SELECT * FROM offline_operations WHERE accountKey = :accountKey AND companyId = :companyId AND branchId = :branchId ORDER BY createdAt")
    suspend fun operations(accountKey: String, companyId: String, branchId: String): List<OfflineOperationEntity>

    @Query("SELECT * FROM offline_operations WHERE accountKey = :accountKey ORDER BY createdAt")
    suspend fun allAccountOperations(accountKey: String): List<OfflineOperationEntity>

    @Query("SELECT DISTINCT branchId FROM offline_operations WHERE accountKey = :accountKey AND companyId = :companyId AND status IN ('PENDING', 'IN_FLIGHT')")
    suspend fun pendingBranches(accountKey: String, companyId: String): List<String>

    @Query("SELECT COUNT(*) FROM offline_operations WHERE accountKey = :accountKey AND status IN ('PENDING', 'IN_FLIGHT', 'CONFLICT', 'REJECTED')")
    suspend fun unresolvedCount(accountKey: String): Int

    @Query("UPDATE offline_operations SET status = 'IN_FLIGHT', attempts = attempts + 1, lastError = NULL WHERE operationId = :operationId AND status = 'PENDING'")
    suspend fun claimOperation(operationId: String): Int

    @Query("UPDATE offline_operations SET status = :status, lastError = :error, serverState = :serverState WHERE operationId = :operationId AND status = 'IN_FLIGHT'")
    suspend fun finishOperation(operationId: String, status: OperationStatus, error: String?, serverState: String?)

    @Query("UPDATE offline_operations SET status = 'PENDING', lastError = :error WHERE operationId = :operationId AND status = 'IN_FLIGHT'")
    suspend fun returnToPending(operationId: String, error: String)

    @Query("UPDATE offline_operations SET status = 'PENDING', lastError = NULL, serverState = NULL WHERE operationId = :operationId AND accountKey = :accountKey AND kind = 'CREATE_CREDIT' AND status = 'REJECTED'")
    suspend fun retryRejectedCredit(operationId: String, accountKey: String): Int

    @Query("UPDATE offline_operations SET status = 'PENDING', lastError = 'Retry after process interruption' WHERE accountKey = :accountKey AND status = 'IN_FLIGHT'")
    suspend fun recoverInFlightOperations(accountKey: String)

    @Query("SELECT * FROM offline_operations WHERE dependsOnOperationId = :dependencyId AND status = 'PENDING'")
    suspend fun pendingDependents(dependencyId: String): List<OfflineOperationEntity>

    @Query("UPDATE offline_operations SET payload = :payload WHERE operationId = :operationId AND status = 'PENDING'")
    suspend fun updatePendingPayload(operationId: String, payload: String)

    @Query("UPDATE offline_operations SET status = 'REJECTED', lastError = :reason WHERE dependsOnOperationId = :dependencyId AND status = 'PENDING'")
    suspend fun rejectPendingDependents(dependencyId: String, reason: String)

    @Query("DELETE FROM offline_operations WHERE accountKey = :accountKey")
    suspend fun deleteOperations(accountKey: String)

    @Query("DELETE FROM customers WHERE accountKey = :accountKey")
    suspend fun deleteCustomers(accountKey: String)

    @Query("DELETE FROM credits WHERE accountKey = :accountKey")
    suspend fun deleteCredits(accountKey: String)

    @Query("DELETE FROM payments WHERE accountKey = :accountKey")
    suspend fun deletePayments(accountKey: String)

    @Query("SELECT * FROM sync_control WHERE accountKey = :accountKey LIMIT 1")
    suspend fun syncControl(accountKey: String): SyncControlEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun setSyncControl(control: SyncControlEntity)

    @Query("SELECT cursor FROM sync_cursors WHERE accountKey = :accountKey AND branchId = :branchId LIMIT 1")
    suspend fun syncCursor(accountKey: String, branchId: String): String?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun setSyncCursor(cursor: SyncCursorEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun setRecordVersions(versions: List<RecordVersionEntity>)

    @Query("SELECT * FROM record_versions WHERE accountKey = :accountKey AND branchId = :branchId AND recordType = :recordType AND recordId = :recordId LIMIT 1")
    suspend fun recordVersion(accountKey: String, branchId: String, recordType: String, recordId: String): RecordVersionEntity?

    @Query("DELETE FROM offline_operations WHERE operationId = :operationId AND status IN ('CONFLICT', 'REJECTED')")
    suspend fun discardResolvedOperation(operationId: String)

    @Query("SELECT COUNT(*) FROM offline_operations WHERE accountKey = :accountKey AND status IN ('CONFLICT', 'REJECTED')")
    suspend fun blockingOperationCount(accountKey: String): Int

    @Query("DELETE FROM sync_cursors WHERE accountKey = :accountKey")
    suspend fun deleteSyncCursors(accountKey: String)

    @Query("DELETE FROM record_versions WHERE accountKey = :accountKey")
    suspend fun deleteRecordVersions(accountKey: String)

    @Query("DELETE FROM customers WHERE accountKey = :accountKey AND branchId != :activeBranchId")
    suspend fun deleteCustomersOutsideBranch(accountKey: String, activeBranchId: String)

    @Query("DELETE FROM credits WHERE accountKey = :accountKey AND branchId != :activeBranchId")
    suspend fun deleteCreditsOutsideBranch(accountKey: String, activeBranchId: String)

    @Query("DELETE FROM payments WHERE accountKey = :accountKey AND branchId != :activeBranchId")
    suspend fun deletePaymentsOutsideBranch(accountKey: String, activeBranchId: String)

    @Query("DELETE FROM sync_cursors WHERE accountKey = :accountKey AND branchId != :activeBranchId")
    suspend fun deleteCursorsOutsideBranch(accountKey: String, activeBranchId: String)

    @Query("DELETE FROM record_versions WHERE accountKey = :accountKey AND branchId != :activeBranchId")
    suspend fun deleteRecordVersionsOutsideBranch(accountKey: String, activeBranchId: String)

    @Query("DELETE FROM sync_control WHERE accountKey = :accountKey")
    suspend fun deleteSyncControl(accountKey: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun markCredit(mark: MarkedCreditEntity)

    @Query("DELETE FROM marked_credits WHERE accountKey = :accountKey AND branchId = :branchId AND creditId = :creditId")
    suspend fun unmarkCredit(accountKey: String, branchId: String, creditId: String)

    @Query("SELECT creditId FROM marked_credits WHERE accountKey = :accountKey AND branchId = :branchId ORDER BY markedAt")
    suspend fun markedCredits(accountKey: String, branchId: String): List<String>

    @Query("DELETE FROM marked_credits WHERE accountKey = :accountKey")
    suspend fun deleteMarkedCredits(accountKey: String)

    @Query("DELETE FROM marked_credits WHERE accountKey = :accountKey AND branchId != :activeBranchId")
    suspend fun deleteMarkedCreditsOutsideBranch(accountKey: String, activeBranchId: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun putReceiptSequences(sequences: List<ReceiptSequenceEntity>)

    @Query("SELECT * FROM receipt_sequences WHERE accountKey = :accountKey AND branchId = :branchId ORDER BY id")
    suspend fun receiptSequences(accountKey: String, branchId: String): List<ReceiptSequenceEntity>

    @Query("DELETE FROM receipt_sequences WHERE accountKey = :accountKey AND branchId = :branchId")
    suspend fun deleteReceiptSequences(accountKey: String, branchId: String)

    @Query("DELETE FROM receipt_sequences WHERE accountKey = :accountKey")
    suspend fun deleteAllReceiptSequences(accountKey: String)

    @Query("DELETE FROM receipt_sequences WHERE accountKey = :accountKey AND branchId != :activeBranchId")
    suspend fun deleteReceiptSequencesOutsideBranch(accountKey: String, activeBranchId: String)

    @Insert
    suspend fun insertActivityLog(entry: ActivityLogEntity)

    @Query("SELECT * FROM activity_log WHERE accountKey = :accountKey ORDER BY createdAt DESC, id DESC")
    suspend fun activityLog(accountKey: String): List<ActivityLogEntity>

    @Query(
        """DELETE FROM activity_log WHERE accountKey = :accountKey AND (createdAt < :cutoff OR id NOT IN (
            SELECT id FROM activity_log WHERE accountKey = :accountKey ORDER BY createdAt DESC, id DESC LIMIT :keep
        ))"""
    )
    suspend fun pruneActivityLog(accountKey: String, cutoff: Long, keep: Int)

    @Query("DELETE FROM activity_log WHERE accountKey = :accountKey")
    suspend fun deleteActivityLog(accountKey: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun putRouteCash(cash: RouteCashEntity)

    @Query("SELECT * FROM route_cash WHERE accountKey = :accountKey AND branchId = :branchId LIMIT 1")
    suspend fun routeCash(accountKey: String, branchId: String): RouteCashEntity?

    @Query("DELETE FROM route_cash WHERE accountKey = :accountKey")
    suspend fun deleteRouteCash(accountKey: String)

    @Query("SELECT * FROM bank_accounts WHERE accountKey = :accountKey AND branchId = :branchId ORDER BY name")
    suspend fun bankAccounts(accountKey: String, branchId: String): List<BankAccountEntity>

    @Query("DELETE FROM bank_accounts WHERE accountKey = :accountKey AND branchId = :branchId")
    suspend fun deleteBranchBankAccounts(accountKey: String, branchId: String)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun putBankAccounts(accounts: List<BankAccountEntity>)

    @Transaction
    suspend fun replaceBankAccounts(accountKey: String, branchId: String, accounts: List<BankAccountEntity>) {
        deleteBranchBankAccounts(accountKey, branchId)
        if (accounts.isNotEmpty()) putBankAccounts(accounts)
    }

    @Query("DELETE FROM bank_accounts WHERE accountKey = :accountKey")
    suspend fun deleteBankAccounts(accountKey: String)
}

@Database(
    entities = [
        CustomerEntity::class, CreditEntity::class, PaymentEntity::class,
        OfflineOperationEntity::class, SyncControlEntity::class, SyncCursorEntity::class, RecordVersionEntity::class,
        MarkedCreditEntity::class, ReceiptSequenceEntity::class, ActivityLogEntity::class,
        RouteCashEntity::class, BankAccountEntity::class
    ],
    version = 13,
    exportSchema = false
)
@TypeConverters(DatabaseConverters::class)
abstract class CreditDatabase : RoomDatabase() {
    abstract fun localDao(): LocalDao

    companion object {
        val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    """CREATE TABLE customers_new (
                        accountKey TEXT NOT NULL, branchId TEXT NOT NULL, id TEXT NOT NULL,
                        documentType TEXT, documentNumber TEXT, firstName TEXT NOT NULL, lastName TEXT NOT NULL,
                        phone TEXT, address TEXT, locallyCreated INTEGER NOT NULL,
                        PRIMARY KEY(accountKey, branchId, id)
                    )""".trimIndent()
                )
                db.execSQL(
                    """INSERT INTO customers_new
                        (accountKey, branchId, id, documentType, documentNumber, firstName, lastName, phone, address, locallyCreated)
                        SELECT accountKey, branchId, id, documentType, documentNumber, firstName, lastName, phone, address, locallyCreated
                        FROM customers"""
                )
                db.execSQL("DROP TABLE customers")
                db.execSQL("ALTER TABLE customers_new RENAME TO customers")
                db.execSQL("CREATE INDEX index_customers_branchId ON customers(branchId)")
                db.execSQL("CREATE INDEX index_customers_accountKey_branchId_documentNumber ON customers(accountKey, branchId, documentNumber)")

                db.execSQL(
                    """CREATE TABLE credits_new (
                        accountKey TEXT NOT NULL, branchId TEXT NOT NULL, id TEXT NOT NULL, customerId TEXT NOT NULL,
                        additionalNumber TEXT, concept TEXT, value TEXT, frequency TEXT, term INTEGER,
                        principal TEXT, balance TEXT, description TEXT, sortOrder REAL, status TEXT,
                        PRIMARY KEY(accountKey, branchId, id)
                    )""".trimIndent()
                )
                db.execSQL(
                    """INSERT INTO credits_new
                        (accountKey, branchId, id, customerId, additionalNumber, principal, balance, sortOrder, status)
                        SELECT accountKey, branchId, id, customerId, cardNumber, principal, balance, orderIndex, status
                        FROM credits"""
                )
                db.execSQL("DROP TABLE credits")
                db.execSQL("ALTER TABLE credits_new RENAME TO credits")
                db.execSQL("CREATE INDEX index_credits_customerId ON credits(customerId)")
                db.execSQL("CREATE INDEX index_credits_accountKey_branchId_status ON credits(accountKey, branchId, status)")

                db.execSQL(
                    """CREATE TABLE payments_new (
                        accountKey TEXT NOT NULL, branchId TEXT NOT NULL, id TEXT NOT NULL, creditId TEXT NOT NULL,
                        amount TEXT, description TEXT, state TEXT, createdAt TEXT, updatedAt TEXT, routeId INTEGER,
                        PRIMARY KEY(accountKey, branchId, id)
                    )""".trimIndent()
                )
                db.execSQL(
                    """INSERT INTO payments_new
                        (accountKey, branchId, id, creditId, amount, description, createdAt)
                        SELECT accountKey, branchId, id, creditId, amount, method, paidAt
                        FROM payments"""
                )
                db.execSQL("DROP TABLE payments")
                db.execSQL("ALTER TABLE payments_new RENAME TO payments")
                db.execSQL("CREATE INDEX index_payments_accountKey_branchId_creditId ON payments(accountKey, branchId, creditId)")
            }
        }

        val MIGRATION_2_3 = object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE credits ADD COLUMN routeId INTEGER")
            }
        }

        val MIGRATION_3_4 = object : Migration(3, 4) {
            override fun migrate(db: SupportSQLiteDatabase) {
                listOf(
                    "sex", "birthDate", "email", "occupation", "personNote", "department", "city",
                    "neighborhood", "maxCredit", "nickname", "customerNote", "customerStatus",
                    "guarantorPersonId"
                ).forEach { db.execSQL("ALTER TABLE customers ADD COLUMN $it TEXT") }
                listOf(
                    "saleId INTEGER", "additionalValue TEXT", "receiptType TEXT", "receiptSeries TEXT",
                    "receiptNumber TEXT", "note TEXT", "createdAt TEXT", "profit TEXT"
                ).forEach { db.execSQL("ALTER TABLE credits ADD COLUMN $it") }
                db.execSQL(
                    """CREATE TABLE IF NOT EXISTS record_versions (
                        accountKey TEXT NOT NULL, branchId TEXT NOT NULL, recordType TEXT NOT NULL,
                        recordId TEXT NOT NULL, cursor TEXT NOT NULL,
                        PRIMARY KEY(accountKey, branchId, recordType, recordId)
                    )""".trimIndent()
                )
                listOf("customers" to "customer", "credits" to "credit", "payments" to "payment")
                    .forEach { (table, type) ->
                        db.execSQL(
                            """INSERT OR REPLACE INTO record_versions
                               SELECT r.accountKey,r.branchId,'$type',r.id,s.cursor
                               FROM $table r JOIN sync_cursors s
                                 ON s.accountKey=r.accountKey AND s.branchId=r.branchId""".trimIndent()
                        )
                    }
            }
        }

        val MIGRATION_4_5 = object : Migration(4, 5) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE payments ADD COLUMN createdLocally INTEGER NOT NULL DEFAULT 0")
                db.execSQL("ALTER TABLE payments ADD COLUMN creatorUsername TEXT")
            }
        }

        val MIGRATION_5_6 = object : Migration(5, 6) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE payments ADD COLUMN origin TEXT")
            }
        }

        val MIGRATION_6_7 = object : Migration(6, 7) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE payments ADD COLUMN creatorUserId INTEGER")
            }
        }

        val MIGRATION_7_8 = object : Migration(7, 8) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    """CREATE TABLE IF NOT EXISTS marked_credits (
                        accountKey TEXT NOT NULL, branchId TEXT NOT NULL, creditId TEXT NOT NULL,
                        markedAt INTEGER NOT NULL,
                        PRIMARY KEY(accountKey, branchId, creditId)
                    )""".trimIndent()
                )
            }
        }

        val MIGRATION_8_9 = object : Migration(8, 9) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    """CREATE TABLE IF NOT EXISTS receipt_sequences (
                        accountKey TEXT NOT NULL, branchId TEXT NOT NULL, id INTEGER NOT NULL,
                        documentType TEXT NOT NULL, series TEXT, lastNumber TEXT,
                        PRIMARY KEY(accountKey, branchId, id)
                    )""".trimIndent()
                )
            }
        }
        val MIGRATION_9_10 = object : Migration(9, 10) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    """CREATE TABLE IF NOT EXISTS activity_log (
                        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, accountKey TEXT NOT NULL,
                        createdAt INTEGER NOT NULL, message TEXT NOT NULL, problem INTEGER NOT NULL
                    )""".trimIndent()
                )
                db.execSQL(
                    "CREATE INDEX IF NOT EXISTS index_activity_log_accountKey_createdAt ON activity_log(accountKey, createdAt)"
                )
            }
        }
        val MIGRATION_10_11 = object : Migration(10, 11) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    """CREATE TABLE IF NOT EXISTS route_cash (
                        accountKey TEXT NOT NULL, branchId TEXT NOT NULL, routeId INTEGER,
                        base TEXT NOT NULL, otherIncome TEXT NOT NULL, expenses TEXT NOT NULL,
                        fetchedAt INTEGER NOT NULL, PRIMARY KEY(accountKey, branchId)
                    )""".trimIndent()
                )
            }
        }

        val MIGRATION_11_12 = object : Migration(11, 12) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE credits ADD COLUMN bankFunded TEXT")
                db.execSQL("ALTER TABLE payments ADD COLUMN bankAmount TEXT")
                db.execSQL(
                    """CREATE TABLE IF NOT EXISTS bank_accounts (
                        accountKey TEXT NOT NULL, branchId TEXT NOT NULL, id INTEGER NOT NULL,
                        name TEXT NOT NULL, type TEXT, number TEXT, PRIMARY KEY(accountKey, branchId, id)
                    )""".trimIndent()
                )
            }
        }

        val MIGRATION_12_13 = object : Migration(12, 13) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE bank_accounts ADD COLUMN holderName TEXT")
                db.execSQL("ALTER TABLE bank_accounts ADD COLUMN holderDocument TEXT")
                // The list is now per-branch authorization; drop the old company-wide cache.
                db.execSQL("DELETE FROM bank_accounts")
            }
        }
    }
}
