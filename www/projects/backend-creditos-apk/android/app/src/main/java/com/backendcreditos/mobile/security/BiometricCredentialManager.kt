package com.backendcreditos.mobile.security

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyPermanentlyInvalidatedException
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import kotlinx.coroutines.suspendCancellableCoroutine
import java.nio.charset.StandardCharsets
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.MessageDigest
import java.security.PrivateKey
import java.security.Signature
import java.security.InvalidKeyException
import java.security.interfaces.ECPublicKey
import java.security.spec.ECGenParameterSpec
import kotlin.coroutines.resume

class BiometricCredentialManager {
    fun hasCredential(accountKey: String): Boolean {
        val alias = aliasFor(accountKey)
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        return keyStore.containsAlias(alias)
    }

    fun ensureCredential(accountKey: String): String {
        val alias = aliasFor(accountKey)
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        val existing = keyStore.getCertificate(alias)?.publicKey as? ECPublicKey
        if (existing != null) return Base64.encodeToString(existing.encoded, Base64.NO_WRAP)
        val generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, ANDROID_KEYSTORE)
        generator.initialize(
            KeyGenParameterSpec.Builder(
                alias,
                KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY
            )
                .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
                .setDigests(KeyProperties.DIGEST_SHA256, KeyProperties.DIGEST_SHA512)
                .setUserAuthenticationRequired(true)
                .setUserAuthenticationValidityDurationSeconds(-1)
                .setInvalidatedByBiometricEnrollment(true)
                .build()
        )
        val pair = generator.generateKeyPair()
        return Base64.encodeToString(pair.public.encoded, Base64.NO_WRAP)
    }

    fun clearCredential(accountKey: String) {
        val alias = aliasFor(accountKey)
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        if (keyStore.containsAlias(alias)) keyStore.deleteEntry(alias)
    }

    suspend fun signChallenge(
        activity: FragmentActivity,
        accountKey: String,
        challengeBase64: String,
        title: String,
        subtitle: String,
    ): Result<String> {
        val challengeBytes = runCatching {
            Base64.decode(challengeBase64, Base64.NO_WRAP)
        }.getOrElse {
            return Result.failure(IllegalArgumentException("El reto biométrico llegó en un formato inválido."))
        }
        val privateKey = runCatching { loadPrivateKey(accountKey) }.getOrElse { error ->
            return Result.failure(error)
        }
        val signature = runCatching {
            Signature.getInstance(SIGNATURE_ALGORITHM).apply {
                initSign(privateKey)
                update(challengeBytes)
            }
        }.getOrElse { error ->
            val message = if (error is InvalidKeyException || error is KeyPermanentlyInvalidatedException) {
                "La credencial biométrica de este dispositivo venció. Actívala de nuevo con tu contraseña."
            } else {
                "No se pudo preparar la firma biométrica."
            }
            return Result.failure(IllegalStateException(message, error))
        }
        return authenticateSignature(activity, signature, title, subtitle)
    }

    private suspend fun authenticateSignature(
        activity: FragmentActivity,
        signature: Signature,
        title: String,
        subtitle: String,
    ): Result<String> = suspendCancellableCoroutine { continuation ->
        val prompt = BiometricPrompt(
            activity,
            ContextCompat.getMainExecutor(activity),
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    if (continuation.isActive) {
                        continuation.resume(Result.failure(IllegalStateException(errString.toString())))
                    }
                }

                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    if (!continuation.isActive) return
                    val crypto = result.cryptoObject?.signature
                    if (crypto == null) {
                        continuation.resume(Result.failure(IllegalStateException("No se recibió la firma biométrica.")))
                        return
                    }
                    val encoded = runCatching {
                        Base64.encodeToString(crypto.sign(), Base64.NO_WRAP)
                    }.getOrElse { error ->
                        continuation.resume(Result.failure(error))
                        return
                    }
                    continuation.resume(Result.success(encoded))
                }
            }
        )
        val info = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setAllowedAuthenticators(androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_STRONG)
            .setNegativeButtonText("Cancelar")
            .build()
        prompt.authenticate(info, BiometricPrompt.CryptoObject(signature))
    }

    private fun loadPrivateKey(accountKey: String): PrivateKey {
        val alias = aliasFor(accountKey)
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        val key = keyStore.getKey(alias, null) as? PrivateKey
        return key ?: throw IllegalStateException(
            "No existe una credencial biométrica para esta cuenta en este dispositivo."
        )
    }

    private fun aliasFor(accountKey: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
            .digest(accountKey.toByteArray(StandardCharsets.UTF_8))
            .joinToString("") { byte -> "%02x".format(byte.toInt() and 0xff) }
        return "${KEY_ALIAS_PREFIX}${digest.take(40)}"
    }

    private companion object {
        const val ANDROID_KEYSTORE = "AndroidKeyStore"
        const val SIGNATURE_ALGORITHM = "SHA256withECDSA"
        const val KEY_ALIAS_PREFIX = "backend-creditos-bio-v1-"
    }
}
