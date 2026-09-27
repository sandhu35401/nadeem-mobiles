package com.nadeemmobile.lock.net

import android.content.Context
import android.os.Build
import com.nadeemmobile.lock.AppConfig
import com.nadeemmobile.lock.store.Prefs.customerId
import com.nadeemmobile.lock.store.Prefs.deviceSecret
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/** HTTPS API client. The backend address is compiled into the app. */
object ApiClient {

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .build()

    private val JSON = "application/json; charset=utf-8".toMediaType()

    class ApiException(message: String) : Exception(message)

    private fun baseUrl(): String {
        val base = AppConfig.API_BASE_URL.trim().trimEnd('/')
        if (base.isEmpty() || base.contains("YOUR-BACKEND-DOMAIN")) {
            throw ApiException("App backend is not configured. Build a release with nadeemApiBaseUrl set.")
        }
        if (!base.startsWith("https://")) {
            throw ApiException("Backend must use HTTPS in production.")
        }
        return base
    }

    private fun post(path: String, body: JSONObject): JSONObject {
        val request = Request.Builder()
            .url("${baseUrl()}$path")
            .post(body.toString().toRequestBody(JSON))
            .build()

        client.newCall(request).execute().use { response ->
            val text = response.body?.string() ?: "{}"
            val json = runCatching { JSONObject(text) }
                .getOrElse { throw ApiException("Invalid response from server.") }
            if (!response.isSuccessful) {
                throw ApiException(
                    json.optString("error", "Server error (${response.code})")
                )
            }
            return json
        }
    }

    /** Called once when the shop provides the 6-digit pairing code. */
    fun pairDevice(context: Context, pairingCode: String, fcmToken: String): JSONObject {
        val body = JSONObject()
            .put("pairingCode", pairingCode)
            .put("fcmToken", fcmToken)
            .put("deviceModel", "${Build.MANUFACTURER} ${Build.MODEL}")
        return post("/api/device/pair", body)
    }

    /** Refresh the token and last-seen timestamp for an enrolled device. */
    fun sendHeartbeat(context: Context, fcmToken: String?) {
        try {
            if (context.customerId == -1) return
            val body = JSONObject().put("customerId", context.customerId)
            if (context.deviceSecret.isNotBlank()) {
                body.put("deviceSecret", context.deviceSecret)
            }
            if (!fcmToken.isNullOrBlank()) body.put("fcmToken", fcmToken)
            val result = post("/api/device/heartbeat", body)
            result.optString("deviceSecret").takeIf { it.isNotBlank() }?.let {
                context.deviceSecret = it
            }
        } catch (_: Exception) {
            // Best effort; the next token refresh / heartbeat can retry.
        }
    }

    /** Acknowledge that the app successfully released Device Owner. */
    fun acknowledgeRelease(context: Context, releaseToken: String): Boolean {
        return try {
            if (context.customerId == -1 || context.deviceSecret.isBlank()) return false
            val body = JSONObject()
                .put("customerId", context.customerId)
                .put("deviceSecret", context.deviceSecret)
                .put("releaseToken", releaseToken)
            post("/api/device/release-ack", body)
            true
        } catch (_: Exception) {
            false
        }
    }
}
