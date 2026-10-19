package com.wikiracr.app

import com.clerk.api.Clerk
import com.clerk.api.ClerkConfigurationOptions
import com.clerk.api.hostedauth.HostedAuthCancellationException
import com.clerk.api.network.serialization.ClerkResult
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout
import org.json.JSONObject

@CapacitorPlugin(name = "WikiRacrAuth")
class WikiRacrAuthPlugin : Plugin() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var observing = false
    private var signingIn = false

    private fun snapshot(): JSObject {
        val result = JSObject()
        val user = Clerk.user
        if (user == null) return result.put("user", JSONObject.NULL)
        val data = JSObject()
        data.put("id", user.id)
        data.put("username", user.username)
        data.put("firstName", user.firstName)
        data.put("fullName", listOfNotNull(user.firstName, user.lastName).joinToString(" "))
        data.put("imageUrl", user.imageUrl)
        data.put("createdAt", user.createdAt)
        data.put("publicMetadata", JSONObject(user.publicMetadata?.toString() ?: "{}"))
        user.primaryEmailAddress?.let { data.put("primaryEmailAddress", JSObject().put("emailAddress", it.emailAddress)) }
        return result.put("user", data)
    }

    @PluginMethod
    fun initialize(call: PluginCall) {
        val key = call.getString("publishableKey") ?: return call.reject("Missing sign-in configuration")
        if (!key.startsWith("pk_live_")) return call.reject("Production sign-in configuration is required")
        scope.launch {
            try {
                if (!Clerk.isInitialized.value) {
                    Clerk.initialize(activity, key, options = ClerkConfigurationOptions(telemetryEnabled = false))
                    withTimeout(20000) { Clerk.isInitialized.first { it } }
                } else {
                    Clerk.refreshClient()
                }
                if (!observing) {
                    observing = true
                    scope.launch { Clerk.userFlow.collect { notifyListeners("authChanged", snapshot()) } }
                }
                call.resolve(snapshot())
            } catch (_: Exception) { call.reject("Could not connect to sign-in. Check your connection and try again.") }
        }
    }

    @PluginMethod
    fun signIn(call: PluginCall) {
        if (signingIn) return call.reject("Sign-in is already open")
        signingIn = true
        scope.launch {
            try {
                when (val result = Clerk.auth.startHostedAuth()) {
                    is ClerkResult.Success -> call.resolve(snapshot())
                    is ClerkResult.Failure -> {
                        if (result.throwable is HostedAuthCancellationException) call.reject("Sign-in cancelled", "AUTH_CANCELLED")
                        else call.reject("Could not sign in. Please try again.")
                    }
                }
            } catch (_: Exception) { call.reject("Could not sign in. Please try again.") }
            finally { signingIn = false }
        }
    }

    @PluginMethod
    fun getToken(call: PluginCall) {
        scope.launch {
            if (Clerk.session == null) { call.resolve(JSObject().put("token", JSONObject.NULL)); return@launch }
            when (val result = Clerk.auth.getToken()) {
                is ClerkResult.Success -> call.resolve(JSObject().put("token", result.value))
                is ClerkResult.Failure -> call.reject("Your session expired. Sign in again.")
            }
        }
    }

    @PluginMethod
    fun signOut(call: PluginCall) {
        scope.launch {
            when (Clerk.auth.signOut()) {
                is ClerkResult.Success -> call.resolve(snapshot())
                is ClerkResult.Failure -> call.reject("Could not sign out. Please try again.")
            }
        }
    }

    override fun handleOnDestroy() {
        scope.cancel()
        super.handleOnDestroy()
    }
}
