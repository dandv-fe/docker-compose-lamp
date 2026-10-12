package com.backendcreditos.mobile.network

import kotlinx.serialization.Serializable

@Serializable
data class MobileAppPolicyDto(
    val latestVersionCode: Int,
    val minimumVersionCode: Int,
    val latestVersionName: String,
    val downloadUrl: String,
    val message: String
)

@Serializable
data class MobileAppPolicyData(val mobileAppPolicy: MobileAppPolicyDto)

@Serializable
data class ReportAppInstallationData(val reportAppInstallation: Boolean)

internal const val MOBILE_APP_POLICY_QUERY = """
    query MobileAppPolicy {
        mobileAppPolicy { latestVersionCode minimumVersionCode latestVersionName downloadUrl message }
    }
"""

internal const val REPORT_APP_INSTALLATION_MUTATION = """
    mutation ReportAppInstallation(${'$'}installationId: String!, ${'$'}versionCode: Int!, ${'$'}versionName: String!) {
        reportAppInstallation(installationId: ${'$'}installationId, versionCode: ${'$'}versionCode, versionName: ${'$'}versionName)
    }
"""
