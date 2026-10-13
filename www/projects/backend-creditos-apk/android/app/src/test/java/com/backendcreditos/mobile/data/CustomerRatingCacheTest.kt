package com.backendcreditos.mobile.data

import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class CustomerRatingCacheTest {
    @Test fun payloadWithoutRatingKeepsCachedValueButExplicitValuesWin() {
        val withoutRating = buildJsonObject { put("id", JsonPrimitive(10)) }
        assertEquals("8", ratingFromServerPayload(withoutRating, null, "8"))
        assertNull(ratingFromServerPayload(withoutRating, null, null))
        val withRating = buildJsonObject { put("id", JsonPrimitive(10)); put("rating", JsonPrimitive("3")) }
        assertEquals("3", ratingFromServerPayload(withRating, "3", "8"))
        val explicitNull = buildJsonObject { put("id", JsonPrimitive(10)); put("rating", JsonNull) }
        assertNull(ratingFromServerPayload(explicitNull, null, "8"))
        assertEquals("nuevo", ratingFromServerPayload(null, "nuevo", "8"))
    }

    @Test fun ratingMetadataAbsentKeepsCachedEachKeyIndependently() {
        val ratingOnly = buildJsonObject { put("id", JsonPrimitive(10)); put("rating", JsonPrimitive("9")) }
        assertEquals("initial", ratingMetadataFromServerPayload(ratingOnly, "ratingConfidence", null, "initial"))
        assertEquals("automatic", ratingMetadataFromServerPayload(ratingOnly, "ratingSource", null, "automatic"))
        // Source can change without score or confidence (manual window expired).
        val sourceOnly = buildJsonObject { put("id", JsonPrimitive(10)); put("ratingSource", JsonPrimitive("automatic")) }
        assertEquals("automatic", ratingMetadataFromServerPayload(sourceOnly, "ratingSource", "automatic", "manual"))
        assertEquals("limited", ratingMetadataFromServerPayload(sourceOnly, "ratingConfidence", null, "limited"))
        assertEquals("8", ratingFromServerPayload(sourceOnly, null, "8"))
        val explicitNull = buildJsonObject { put("ratingConfidence", JsonNull) }
        assertNull(ratingMetadataFromServerPayload(explicitNull, "ratingConfidence", null, "initial"))
        assertEquals("established", ratingMetadataFromServerPayload(null, "ratingConfidence", "established", "initial"))
    }
}
