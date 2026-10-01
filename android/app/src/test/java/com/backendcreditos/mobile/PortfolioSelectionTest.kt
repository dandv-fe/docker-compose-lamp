package com.backendcreditos.mobile

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PortfolioSelectionTest {
    @Test fun firstTapSelectsAndSecondTapOnTheSameCardOpensInlinePayment() {
        assertEquals(PortfolioTap.SELECT, portfolioTap(null, "credit-1"))
        assertEquals(PortfolioTap.OPEN, portfolioTap("credit-1", "credit-1"))
        assertEquals(PortfolioTap.SELECT, portfolioTap("credit-1", "credit-2"))
    }

    @Test fun aPointerPlacedWithoutTappingNeedsAFirstTapBeforeOpening() {
        assertEquals(PortfolioTap.SELECT, portfolioTap("credit-1", "credit-1", pointerArmed = false))
        assertEquals(PortfolioTap.OPEN, portfolioTap("credit-1", "credit-1", pointerArmed = true))
    }

    @Test fun selectionSurvivesAnEmptyCacheAndDefaultsToTheFirstAvailableCard() {
        assertEquals("credit-1", keepSelection("credit-1", listOf("credit-1"), emptyList()))
        assertEquals(
            "credit-1",
            keepSelection("credit-1", listOf("credit-2", "credit-1"), listOf("credit-2", "credit-1"))
        )
        assertEquals(
            "credit-1",
            keepSelection(null, emptyList(), listOf("credit-1", "credit-2"))
        )
        assertNull(keepSelection(null, emptyList(), emptyList()))
    }

    @Test fun aRemovedSelectionMovesToTheNearestPreviousCardThenTheNext() {
        val previous = listOf("a", "b", "c", "d")
        assertEquals("b", keepSelection("c", previous, listOf("a", "b", "d")))
        assertEquals("a", keepSelection("c", previous, listOf("a", "d")))
        assertEquals("d", keepSelection("c", previous, listOf("d")))
        assertEquals("a", keepSelection("c", previous, listOf("a")))
    }

    @Test fun arrowsWalkTheVisibleListAndStopAtBothEnds() {
        val visible = listOf("a", "b", "c")
        assertEquals("b", pointerStep("a", visible, forward = true))
        assertEquals("a", pointerStep("b", visible, forward = false))
        assertNull(pointerStep("c", visible, forward = true))
        assertNull(pointerStep("a", visible, forward = false))
        assertNull(pointerStep(null, emptyList(), forward = true))
    }

    @Test fun arrowsStartFromAnEndWhenNothingIsPointedOrTheCardIsFilteredOut() {
        val visible = listOf("a", "b", "c")
        assertEquals("a", pointerStep(null, visible, forward = true))
        assertEquals("c", pointerStep(null, visible, forward = false))
        assertEquals("a", pointerStep("hidden", visible, forward = true))
    }

    @Test fun counterShowsTheOneBasedPositionOnlyForAVisiblePointedCard() {
        val visible = listOf("a", "b", "c")
        assertEquals(2, pointerPosition("b", visible))
        assertNull(pointerPosition("hidden", visible))
        assertNull(pointerPosition(null, visible))
    }
}
