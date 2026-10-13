package com.backendcreditos.mobile

import com.backendcreditos.mobile.network.CustomerRatingDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CustomerRatingTest {
    private fun remote(
        canRate: Boolean, raw: String = "7", source: String = "automatic", confidence: String = "established",
        automaticScore: Int = parseCustomerRatingScore(raw) ?: INITIAL_POLICY_SCORE, manualUntil: String? = null,
        evaluatedAt: String? = "2026-10-13T14:00:00.000Z"
    ) = CustomerRatingDto(
        score = parseCustomerRatingScore(raw), label = "x", rawRating = raw, canRate = canRate,
        automaticScore = automaticScore, source = source, manualUntil = manualUntil, evaluatedAt = evaluatedAt,
        confidence = confidence, explanation = "Pagos al día en las últimas tarjetas.", history = emptyList()
    )

    private fun editing(
        remote: CustomerRatingDto? = remote(true), score: Int? = 8, reason: String = "Paga puntual",
        saving: Boolean = false, locallyCreated: Boolean = false
    ) = RatingDialogState(
        accountKey = "acc", branchId = "4", customerId = "10", customerName = "Cliente", cachedRating = "7",
        locallyCreated = locallyCreated, remote = remote, editing = true,
        draftScore = score, draftReason = reason, saving = saving
    )

    @Test fun everyManualScoreFrom1To10ParsesAndFallsInItsCategory() {
        val expected = mapOf(
            1 to CustomerRatingCategory.FOLLOW_UP, 2 to CustomerRatingCategory.FOLLOW_UP,
            3 to CustomerRatingCategory.FOLLOW_UP, 4 to CustomerRatingCategory.FOLLOW_UP,
            5 to CustomerRatingCategory.REGULAR, 6 to CustomerRatingCategory.REGULAR,
            7 to CustomerRatingCategory.GOOD, 8 to CustomerRatingCategory.GOOD,
            9 to CustomerRatingCategory.EXCELLENT, 10 to CustomerRatingCategory.EXCELLENT
        )
        for ((score, category) in expected) {
            assertEquals(score, parseCustomerRatingScore(score.toString()))
            assertEquals(category, CustomerRatingCategory.of(score))
            assertEquals("$score/10 · ${category.label}", customerRatingText(score.toString(), "established"))
            assertEquals("$score/10 · ${category.label}", customerRatingText(score.toString(), null))
            assertEquals(category, ratingBadgeInfo(score.toString(), "limited").category)
        }
        assertEquals("Requiere seguimiento", CustomerRatingCategory.of(4).label)
        assertEquals("Regular", CustomerRatingCategory.of(5).label)
        assertEquals("Bueno", CustomerRatingCategory.of(7).label)
        assertEquals("Excelente", CustomerRatingCategory.of(9).label)
        assertEquals("10/10 · Excelente", customerRatingText(10))
        assertEquals("4/10 · Requiere seguimiento", customerRatingText(4))
    }

    @Test fun parserStaysNullableForNewBlankNullAndInvalid() {
        for (raw in listOf(null, "", "   ", " 7 ", "7 ", " 7", "07", "010", "nuevo", "NUEVO", "0", "00", "11", "100", "-3", "5.5", "abc", "7a", "١")) {
            assertNull("'$raw' is not a stored score", parseCustomerRatingScore(raw))
        }
        assertEquals(CustomerRatingCategory.UNRECOGNIZED, CustomerRatingCategory.of(null))
        assertEquals(CustomerRatingCategory.UNRECOGNIZED, CustomerRatingCategory.of(0))
        assertEquals(CustomerRatingCategory.UNRECOGNIZED, CustomerRatingCategory.of(11))
        assertEquals("Sin nota", customerRatingText(null as Int?))
    }

    @Test fun legacyNewAndBlankShowInitialPolicyFiveButStayUnparsed() {
        for (raw in listOf("nuevo", "")) {
            val badge = ratingBadgeInfo(raw, null)
            assertEquals("5/10 · Inicial, poca historia", badge.text)
            assertEquals(CustomerRatingCategory.INITIAL, badge.category)
            assertEquals(INITIAL_POLICY_SCORE, badge.score)
            assertNull(parseCustomerRatingScore(raw))
        }
        // Initial confidence without a manual source keeps the initial label, whatever the number.
        assertEquals("5/10 · Inicial, poca historia", ratingBadgeInfo("5", "initial").text)
        assertEquals("5/10 · Regular", ratingBadgeInfo("5", "limited").text)
        assertEquals("5/10 · Regular", ratingBadgeInfo("5", null).text)
    }

    @Test fun notDownloadedInvalidAndLocalCustomersAreNeverShownAsRealOrHighScores() {
        val pending = ratingBadgeInfo(null, null)
        assertEquals("Nota pendiente de sincronizar", pending.text)
        assertEquals(CustomerRatingCategory.PENDING, pending.category)
        assertNull(pending.score)
        // Even with a cached confidence, a missing rating is still pending, never a score.
        assertNull(ratingBadgeInfo(null, "established").score)
        for (raw in listOf("   ", " 7 ", "07", "0", "11", "NUEVO", "abc", "9.5")) {
            val badge = ratingBadgeInfo(raw, "established")
            assertEquals("'$raw'", CustomerRatingCategory.UNRECOGNIZED, badge.category)
            assertNull(badge.score)
            assertEquals("Nota por revisar", badge.text)
        }
        val local = ratingBadgeInfo(null, null, locallyCreated = true)
        assertEquals("5/10 · Inicial provisional", local.text)
        assertEquals(CustomerRatingCategory.INITIAL, local.category)
        assertEquals("5/10 · Inicial provisional", ratingBadgeInfo("9", "established", locallyCreated = true).text)
        for (info in listOf(pending, local, ratingBadgeInfo("abc", null))) {
            assertFalse(info.text.contains("Sin calificar"))
        }
    }

    @Test fun reasonIsTrimmedAndBoundedAndScoreMustBeSelected() {
        assertEquals("Elige una nota entre 1 y 10.", ratingInputError(null, "Paga puntual"))
        assertTrue(ratingInputError(0, "Paga puntual") != null)
        assertTrue(ratingInputError(11, "Paga puntual") != null)
        assertTrue(ratingInputError(8, "  abcd  ") != null)
        assertNull(ratingInputError(8, "  abcde  "))
        assertNull(ratingInputError(1, "x".repeat(500)))
        assertNull(ratingInputError(10, " " + "x".repeat(500) + " "))
        assertTrue(ratingInputError(10, "x".repeat(501)) != null)
        // Counted in code points: 500 emoji are 1000 UTF-16 units but still a valid reason.
        val emoji = "\uD83D\uDE00"
        assertEquals(500, ratingReasonLength(emoji.repeat(500)))
        assertNull(ratingInputError(9, emoji.repeat(500)))
        assertTrue(ratingInputError(9, emoji.repeat(501)) != null)
        assertTrue(ratingInputError(9, emoji.repeat(4)) != null)
        assertNull(ratingInputError(9, emoji.repeat(5)))
    }

    @Test fun editorNeedsOnlineServerAnswerWithCanRate() {
        assertEquals(RatingEditorAccess.OFFLINE, ratingEditorAccess(false, false, remote(true)))
        assertEquals(RatingEditorAccess.NOT_LOADED, ratingEditorAccess(true, false, null))
        assertEquals(RatingEditorAccess.NOT_PERMITTED, ratingEditorAccess(true, false, remote(false)))
        assertEquals(RatingEditorAccess.UNCONFIRMED_CUSTOMER, ratingEditorAccess(true, true, remote(true)))
        assertEquals(RatingEditorAccess.ALLOWED, ratingEditorAccess(true, false, remote(true)))
        assertNull(ratingEditorNotice(RatingEditorAccess.ALLOWED))
        assertTrue(ratingEditorNotice(RatingEditorAccess.OFFLINE)!!.contains("requieren conexión"))
    }

    @Test fun submitGuardBlocksDuplicatesOfflineInvalidAndUnauthorized() {
        assertTrue(canSubmitRating(editing(), online = true))
        assertFalse(canSubmitRating(editing(), online = false))
        assertFalse(canSubmitRating(editing(saving = true), online = true))
        assertFalse(canSubmitRating(editing(remote = remote(false)), online = true))
        assertFalse(canSubmitRating(editing(remote = null), online = true))
        assertFalse(canSubmitRating(editing(score = null), online = true))
        assertFalse(canSubmitRating(editing(reason = " ok "), online = true))
        assertFalse(canSubmitRating(editing(locallyCreated = true), online = true))
        assertFalse(canSubmitRating(editing().copy(editing = false), online = true))
    }

    @Test fun dialogBelongsOnlyToItsAccountAndBranchAndIgnoresLateReplies() {
        val opened = editing().copy(instanceId = 1)
        assertTrue(ratingDialogBelongsTo(opened, "acc", "4"))
        assertFalse(ratingDialogBelongsTo(opened, "acc", "5"))
        assertFalse(ratingDialogBelongsTo(opened, "other", "4"))
        assertFalse(ratingDialogBelongsTo(opened, null, null))
        assertTrue(isSameRatingDialog(opened.copy(saving = true, draftReason = "Otro motivo"), opened))
        assertFalse(isSameRatingDialog(null, opened))
        // Closed and reopened for the same customer: the old reply must not land in the new dialog.
        assertFalse(isSameRatingDialog(opened.copy(instanceId = 2), opened))
        assertFalse(isSameRatingDialog(opened.copy(customerId = "11"), opened))
        assertFalse(isSameRatingDialog(opened.copy(branchId = "5"), opened))
    }

    @Test fun uncertainSaveKeepsDraftButBlocksResubmitUntilRefresh() {
        val sending = editing().copy(saving = true, confirming = true)
        val after = ratingAfterUncertainSave(sending)
        assertNull(after.remote)
        assertFalse(after.saving)
        assertFalse(after.confirming)
        assertTrue(after.editing)
        assertEquals(8, after.draftScore)
        assertEquals("Paga puntual", after.draftReason)
        assertEquals(RATING_SAVE_UNCERTAIN, after.saveError)
        assertFalse(canSubmitRating(after, online = true))
        assertEquals(RatingEditorAccess.NOT_LOADED, ratingEditorAccess(true, false, after.remote))
        // Only a successful refresh (new server snapshot) re-enables the confirm with the kept draft.
        assertTrue(canSubmitRating(after.copy(remote = remote(true, "8")), online = true))
    }

    @Test fun ratingMissingFromCacheIsExplainedNotTreatedAsKnown() {
        val migrated = RatingDialogState("acc", "4", "10", "Cliente", cachedRating = null)
        assertNull(migrated.displayScore)
        assertTrue(ratingCacheNotice(migrated)!!.contains("aún no está descargada"))
        assertNull(ratingCacheNotice(migrated.copy(cachedRating = "nuevo")))
        assertNull(ratingCacheNotice(migrated.copy(remote = remote(false))))
        assertNull(ratingCacheNotice(migrated.copy(locallyCreated = true)))
    }

    @Test fun historyTimeIsUtcIsoShownInLocalZone() {
        val bogota = java.time.ZoneId.of("America/Bogota")
        assertEquals("2026-10-13 09:05", formatRatingHistoryTime("2026-10-13T14:05:09.123Z", bogota))
        assertEquals("2026-10-12 19:00", formatRatingHistoryTime("2026-10-13T00:00:00.000Z", bogota))
        assertEquals("legacy", formatRatingHistoryTime("legacy", bogota))
    }

    @Test fun dialogShowsServerScoreOverCachedAndCachedWhenOffline() {
        val offline = RatingDialogState("acc", "4", "10", "Cliente", cachedRating = "nuevo")
        assertEquals(INITIAL_POLICY_SCORE, offline.displayScore)
        assertEquals("5/10 · Inicial, poca historia", offline.badge.text)
        assertEquals("5/10 · Inicial, poca historia", offline.copy(cachedRating = "5", cachedConfidence = "initial").badge.text)
        assertEquals(6, offline.copy(cachedRating = "6").displayScore)
        assertEquals(9, offline.copy(cachedRating = "6", remote = remote(true, "9")).displayScore)
        val withoutScore = remote(false, "8").copy(score = null)
        assertEquals(8, offline.copy(remote = withoutScore).displayScore)
    }

    @Test fun serverAnswerOutsideContractIsRejectedNotGuessed() {
        assertNull(customerRatingContractError(remote(true)))
        assertNull(customerRatingContractError(remote(true, "nuevo", confidence = "initial", evaluatedAt = null)))
        assertNull(customerRatingContractError(remote(true, "8", source = "manual", manualUntil = "2026-10-20T14:00:00.000Z")))
        val bad = listOf(
            remote(true).copy(source = "auto"),
            remote(true).copy(source = "Manual"),
            remote(true).copy(confidence = "high"),
            remote(true).copy(automaticScore = 0),
            remote(true).copy(automaticScore = 11),
            remote(true).copy(score = 12),
            remote(true).copy(explanation = "  "),
            remote(true).copy(evaluatedAt = "2026-10-13 14:00:00"),
            remote(true, source = "manual").copy(manualUntil = "mañana"),
            remote(true).copy(history = listOf(
                com.backendcreditos.mobile.network.CustomerRatingHistoryDto("1", 5, null, "x", "engine", "2026-10-13T14:00:00.000Z", 0)
            )),
            remote(true).copy(rawRating = "x".repeat(51))
        )
        bad.forEach { assertTrue("$it", customerRatingContractError(it) != null) }
    }

    @Test fun portfolioMetadataFollowsBackendLabelRule() {
        assertEquals("7/10 · Inicial, poca historia", ratingBadgeInfo("7", "initial", source = "automatic").text)
        assertEquals("7/10 · Inicial, poca historia", ratingBadgeInfo("7", "initial", source = null).text)
        assertEquals("7/10 · Bueno", ratingBadgeInfo("7", "limited", source = "automatic").text)
        assertEquals("7/10 · Bueno", ratingBadgeInfo("7", null, source = "manual").text)
        // Pre-014 numeric note without state: source manual, confidence null.
        assertEquals("8/10 · Bueno", ratingBadgeInfo("8", null, source = null).text)
        // Metadata outside the contract is flagged explicitly, never guessed.
        assertEquals("Nota por revisar", ratingBadgeInfo("7", "high", source = "automatic").text)
        assertEquals("Nota por revisar", ratingBadgeInfo("7", "limited", source = "auto").text)
        assertEquals("5/10 · Inicial, poca historia", ratingBadgeInfo("nuevo", "established", source = "manual").text)
        assertEquals("5/10 · Regular", ratingBadgeInfo("5", "initial", source = "manual").text)
        assertEquals("9/10 · Excelente", ratingBadgeInfo("9", "initial", source = "manual").text)
        // Cached metadata never invents a score for a rating that was not downloaded.
        assertEquals("Nota pendiente de sincronizar", ratingBadgeInfo(null, "established", source = "automatic").text)
        val cachedManual = RatingDialogState("acc", "4", "10", "Cliente", cachedRating = "5", cachedSource = "manual", cachedConfidence = "initial")
        assertEquals("5/10 · Regular", cachedManual.badge.text)
        val manual = remote(true, "5", source = "manual", confidence = "initial", manualUntil = "2026-10-20T14:00:00.000Z")
        // A manual 5 set by an admin is a real "Regular", not the initial policy.
        val dialog = RatingDialogState("acc", "4", "10", "Cliente", cachedRating = "5", remote = manual)
        assertEquals("5/10 · Regular", dialog.badge.text)
    }

    @Test fun detailLinesExplainSourceManualPriorityAutomaticScoreAndConfidence() {
        val bogota = java.time.ZoneId.of("America/Bogota")
        val manual = remote(
            true, "9", source = "manual", confidence = "limited", automaticScore = 6,
            manualUntil = "2026-10-20T14:00:00.000Z", evaluatedAt = "2026-10-13T14:05:00.000Z"
        )
        assertEquals(listOf(
            "Fuente vigente: Manual",
            "Nota manual vigente hasta 2026-10-20 09:00; después vuelve la automática.",
            "Automática: 6/10 · Regular",
            "Confianza: Limitada · historia corta",
            "Actualizada: 2026-10-13 09:05"
        ), ratingDetailLines(manual, bogota))
        val initial = remote(true, "5", confidence = "initial", evaluatedAt = null)
        assertEquals(listOf(
            "Fuente vigente: Automática",
            "Automática: 5/10 · Inicial, poca historia",
            "Confianza: Inicial · poca historia",
            "Actualizada: aún sin evaluar"
        ), ratingDetailLines(initial, bogota))
        assertEquals("Automática", ratingSourceLabel("automatic"))
        assertEquals("Manual", ratingSourceLabel("manual"))
        assertTrue(MANUAL_PRIORITY_NOTICE.contains("7 días"))
        assertTrue(MANUAL_PRIORITY_NOTICE.contains("no reinicia"))
    }

    @Test fun historyNullScoreMeansBackToInitialAndAutomaticEntriesAreValid() {
        assertEquals("5/10 · Inicial, poca historia", ratingHistoryScoreText(null))
        assertEquals("8/10 · Bueno", ratingHistoryScoreText(8))
        val automaticEntry = com.backendcreditos.mobile.network.CustomerRatingHistoryDto(
            "9", null, 6, "Vuelve a nota inicial", "automatic", "2026-10-13T14:00:00.000Z", 0
        )
        assertNull(customerRatingContractError(remote(true, "nuevo", confidence = "initial").copy(history = listOf(automaticEntry))))
        // Legacy manual rating without manual window is valid and explained, not rejected.
        val legacy = remote(true, "8", source = "manual", manualUntil = null)
        assertNull(customerRatingContractError(legacy))
        assertTrue(ratingDetailLines(legacy).contains("Nota manual sin fecha de vencimiento informada."))
    }

    @Test fun ratingQueryMetadataIsStoredWithPortfolioSemantics() {
        val pending = remote(true, "nuevo", confidence = "initial", evaluatedAt = null)
        assertNull(pending.customerSource())
        assertNull(pending.customerConfidence())
        val previousNote = remote(true, "8", source = "manual", confidence = "initial", evaluatedAt = null)
        assertEquals("manual", previousNote.customerSource())
        assertNull(previousNote.customerConfidence())
        assertEquals("8/10 · Bueno", ratingBadgeInfo("8", previousNote.customerConfidence(), source = previousNote.customerSource()).text)
        val evaluated = remote(true, "6", confidence = "limited")
        assertEquals("automatic", evaluated.customerSource())
        assertEquals("limited", evaluated.customerConfidence())
    }
}
