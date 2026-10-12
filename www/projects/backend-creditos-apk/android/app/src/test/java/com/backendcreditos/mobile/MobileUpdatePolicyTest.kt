package com.backendcreditos.mobile

import com.backendcreditos.mobile.network.MobileAppPolicyDto
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class MobileUpdatePolicyTest {
    private val policy = MobileAppPolicyDto(4, 2, "0.4.0", "https://example.invalid/app.apk", "")

    @Test fun distinguishesRecommendedRequiredAndNewerVersions() {
        validateMobileAppPolicy(policy)
        assertTrue(updateRequired(policy, 1))
        assertFalse(updateRequired(policy, 2))
        assertTrue(updateAvailable(policy, 2))
        assertFalse(updateAvailable(policy, 4))
        assertFalse(updateAvailable(policy, 5))
        assertFalse(updateRequired(null, 1))
    }

    @Test fun rejectsInvalidLimitsAndUnsafeDownloadLinks() {
        for (invalid in listOf(
            policy.copy(minimumVersionCode = 0),
            policy.copy(minimumVersionCode = 5),
            policy.copy(downloadUrl = "http://example.invalid/app.apk"),
            policy.copy(downloadUrl = "https://user:secret@example.invalid/app.apk"),
            policy.copy(downloadUrl = "file:///tmp/app.apk"),
            policy.copy(downloadUrl = ""),
            policy.copy(latestVersionName = "")
        )) {
            assertThrows(IllegalArgumentException::class.java) { validateMobileAppPolicy(invalid) }
        }
        validateMobileAppPolicy(policy.copy(minimumVersionCode = 1, downloadUrl = ""))
    }
}
