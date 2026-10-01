package com.backendcreditos.mobile.network

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class ServerConnectionSettingsTest {
    @Test
    fun `domain receives https and graphql path`() {
        assertEquals(
            "https://api.example.com/graphql",
            normalizeGraphQlEndpoint("api.example.com")
        )
    }

    @Test
    fun `complete endpoint keeps its configured path`() {
        assertEquals(
            "https://api.example.com/creditos/graphql",
            normalizeGraphQlEndpoint("https://api.example.com/creditos/graphql/")
        )
    }

    @Test
    fun `production rejects cleartext and credential-bearing URLs`() {
        assertThrows(IllegalArgumentException::class.java) {
            normalizeGraphQlEndpoint("http://api.example.com/graphql")
        }
        assertThrows(IllegalArgumentException::class.java) {
            normalizeGraphQlEndpoint("https://user:pass@api.example.com/graphql")
        }
    }

    @Test
    fun `debug may explicitly allow a local http endpoint`() {
        assertEquals(
            "http://192.168.1.53:3000/graphql",
            normalizeGraphQlEndpoint("http://192.168.1.53:3000/graphql", allowHttp = true)
        )
    }
}
