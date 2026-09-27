package com.nadeemmobile.lock.fcm

import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.nadeemmobile.lock.admin.PolicyManager
import com.nadeemmobile.lock.net.ApiClient
import com.nadeemmobile.lock.store.Prefs.clearEnrollment
import com.nadeemmobile.lock.store.Prefs.isLocked
import com.nadeemmobile.lock.store.Prefs.lockMessage
import com.nadeemmobile.lock.store.Prefs.shopName
import com.nadeemmobile.lock.store.Prefs.shopPhone
import com.nadeemmobile.lock.ui.LockActivity

class LockFirebaseMessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(message: RemoteMessage) {
        when (message.data["type"]?.trim()?.uppercase()) {
            "LOCK" -> handleLock(message)
            "UNLOCK" -> handleUnlock()
            "RELEASE" -> handleRelease(message.data["releaseToken"].orEmpty())
        }
    }

    private fun handleLock(message: RemoteMessage) {
        if (!PolicyManager.isDeviceOwner(this)) return

        isLocked = true
        lockMessage = message.data["message"].orEmpty()
        message.data["shopName"]?.let { shopName = it }
        message.data["shopPhone"]?.let { shopPhone = it }

        PolicyManager.applyLockRestrictions(this)

        val lockIntent = Intent(this, LockActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_CLEAR_TASK or
                Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        runCatching { startActivity(lockIntent) }
    }

    private fun handleUnlock() {
        if (!PolicyManager.isDeviceOwner(this)) return

        isLocked = false
        PolicyManager.clearLockRestrictions(this)
        sendBroadcast(
            Intent(LockActivity.ACTION_UNLOCK).setPackage(packageName)
        )
    }

    private fun handleRelease(releaseToken: String) {
        if (!PolicyManager.isDeviceOwner(this)) return
        if (releaseToken.isBlank()) return

        // Release is intentionally terminal: once Device Owner is cleared,
        // this installation is no longer managed by Nadeem Mobiles.
        val wasLocked = isLocked
        isLocked = false

        // Let a visible LockActivity leave Lock Task mode before Device Owner
        // is cleared. If there is no visible lock screen, this is harmless.
        if (wasLocked) {
            sendBroadcast(Intent(LockActivity.ACTION_UNLOCK).setPackage(packageName))
        }

        Handler(Looper.getMainLooper()).postDelayed({
            val released = runCatching {
                PolicyManager.prepareForRelease(this)
            }.getOrDefault(false)

            if (!released) return@postDelayed

            // Best-effort acknowledgement before opening the Android uninstall flow.
            ApiClient.acknowledgeRelease(this, releaseToken)
            clearEnrollment(this)

            val uninstallIntent = Intent(Intent.ACTION_UNINSTALL_PACKAGE).apply {
                data = Uri.parse("package:$packageName")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            runCatching { startActivity(uninstallIntent) }
        }, if (wasLocked) 300L else 0L)
    }

    override fun onNewToken(token: String) {
        ApiClient.sendHeartbeat(applicationContext, token)
    }
}
