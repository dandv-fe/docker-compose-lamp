package com.backendcreditos.mobile.location

import org.junit.Assert.assertEquals
import org.junit.Test

class GeoUriTest {
    @Test fun geoUriContainsCoordinatesAndEncodedLabel() {
        assertEquals(
            "geo:4.711,-74.072?q=4.711,-74.072(Casa%20principal)",
            geoUriStringForLocation(4.711, -74.072, "Casa principal")
        )
    }
}
