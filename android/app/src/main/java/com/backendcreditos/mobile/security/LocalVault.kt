package com.backendcreditos.mobile.security

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import kotlinx.serialization.Serializable
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File
import java.security.KeyStore
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

@Serializable
data class StoredSession(
    val companyId: String,
    val username: String,
    val token: String,
    val selectedBranchId: String? = null
) {
    val accountKey: String
        get() = MessageDigest.getInstance("SHA-256")
            .digest("$companyId\u0000$username".toByteArray(Charsets.UTF_8))
            .joinToString("") { byte -> "%02x".format(byte.toInt() and 0xff) }
}

class LocalVault(context: Context) {
    private val directory = context.noBackupFilesDir
    private val sessionFile = File(directory, "session.enc")
    private val databaseKeyFile = File(directory, "database-key.enc")
    private val json = Json

    @Synchronized
    fun saveSession(session: StoredSession) {
        writeEncrypted(sessionFile, json.encodeToString(StoredSession.serializer(), session).toByteArray(Charsets.UTF_8))
    }

    @Synchronized
    fun readSession(): StoredSession? = runCatching {
        if (!sessionFile.exists()) null
        else json.decodeFromString(StoredSession.serializer(), String(readEncrypted(sessionFile), Charsets.UTF_8))
    }.getOrNull()

    @Synchronized
    fun updateSession(transform: (StoredSession) -> StoredSession) {
        readSession()?.let(transform)?.let(::saveSession)
    }

    @Synchronized
    fun clearSession() {
        sessionFile.delete()
    }

    @Synchronized
    fun databaseKey(): ByteArray {
        if (databaseKeyFile.exists()) return readEncrypted(databaseKeyFile)
        val key = ByteArray(32).also(SecureRandom()::nextBytes)
        writeEncrypted(databaseKeyFile, key)
        return key
    }

    private fun writeEncrypted(file: File, cleartext: ByteArray) {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, keystoreKey())
        val encrypted = cipher.doFinal(cleartext)
        file.writeBytes(cipher.iv + encrypted)
    }

    private fun readEncrypted(file: File): ByteArray {
        val contents = file.readBytes()
        require(contents.size > IV_LENGTH) { "Encrypted local data is incomplete." }
        val iv = contents.copyOfRange(0, IV_LENGTH)
        val encrypted = contents.copyOfRange(IV_LENGTH, contents.size)
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.DECRYPT_MODE, keystoreKey(), GCMParameterSpec(128, iv))
        return cipher.doFinal(encrypted)
    }

    private fun keystoreKey(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(
            KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build()
        )
        return generator.generateKey()
    }

    private companion object {
        const val KEY_ALIAS = "backend-creditos-local-store-v1"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val IV_LENGTH = 12
    }
}
