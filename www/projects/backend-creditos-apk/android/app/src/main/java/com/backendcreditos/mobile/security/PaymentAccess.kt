package com.backendcreditos.mobile.security

internal fun paymentAccessBlocked(expiresAt: Long?, nowMillis: Long): Boolean =
    expiresAt == -1L || (expiresAt != null && nowMillis >= expiresAt)
