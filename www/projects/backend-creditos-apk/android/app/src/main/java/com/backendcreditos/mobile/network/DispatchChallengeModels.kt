package com.backendcreditos.mobile.network

import kotlinx.serialization.Serializable

@Serializable
data class DispatchChallengesData(val myDispatchChallenges: DispatchChallengesDto)

@Serializable
data class DispatchChallengesDto(val employeeId: Int, val asOf: String, val items: List<DispatchChallengeDto>)

@Serializable
data class DispatchChallengeDto(
    val challengeId: String,
    val routeId: Int,
    val branchId: Int,
    val branchName: String,
    val routeState: String,
    val assigned: Boolean,
    val status: String,
    val invitationDate: String,
    val deadline: String,
    val description: String,
    val incrementPercent: Double,
    val capitalGoal: Double,
    val collectionGoal: Double,
    val salary: PayrollPeriodDto,
    val allocation: ChallengeAllocationDto,
    val goal: ChallengeGoalDto,
    val progress: ChallengeProgressDto,
    val forecast: ChallengeForecastDto
)

@Serializable
data class ChallengeAllocationDto(val weight: Double, val capitalRate: Double, val collectionRate: Double)

@Serializable
data class ChallengeGoalDto(
    val targetCommission: Double,
    val otherCommission: Double,
    val routeCommission: Double,
    val commissionGap: Double,
    val capitalRequired: Double?,
    val collectionRequired: Double?,
    val projectedCommission: Double,
    val projectedEarnedWithoutBonuses: Double,
    val surplusAmount: Double,
    val surplusPercent: Double?
)

@Serializable
data class ChallengeProgressDto(
    val creditedCapital: Double,
    val creditedCollection: Double,
    val capitalTarget: Double,
    val collectionTarget: Double,
    val capitalPercent: Double?,
    val collectionPercent: Double?,
    val commissionAmount: Double,
    val targetCommission: Double,
    val commissionPercent: Double?,
    val achieved: Boolean
)

@Serializable
data class ChallengeForecastDto(
    val estimated: Boolean,
    val status: String,
    val collections: ChallengeCollectionsDto?,
    val warnings: List<String>
)

@Serializable
data class ChallengeCollectionsDto(
    val estimated: Boolean,
    val status: String,
    val dueAmount: Double,
    val arrearsAmount: Double,
    val advanceAmount: Double,
    val cardCount: Int,
    val invalidCardCount: Int,
    val invalidReasons: List<String>,
    val warnings: List<String>
)
