package com.nadeemmobile.lock.boot

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.nadeemmobile.lock.admin.PolicyManager
import com.nadeemmobile.lock.store.Prefs.isLocked
import com.nadeemmobile.lock.ui.LockActivity

class BootReceiver : BroadcastReceiver() {

    override fun onReceive(
        context: Context,
        intent: Intent?
    ) {
        when (intent?.action) {

            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_USER_UNLOCKED -> {
                restoreLock(context)
            }
        }
    }

    private fun restoreLock(context: Context) {

        // This app must still be Device Owner.
        if (!PolicyManager.isDeviceOwner(context)) {
            return
        }

        // If admin already unlocked the device,
        // do not restore the lock after reboot.
        if (!context.isLocked) {
            return
        }

        // Re-apply all temporary lock restrictions.
        try {
            PolicyManager.applyLockRestrictions(context)
        } catch (e: Exception) {
            e.printStackTrace()
        }

        // Open the lock screen again.
        val lockIntent = Intent(
            context,
            LockActivity::class.java
        ).apply {
            flags =
                Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_CLEAR_TASK or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP
        }

        try {
            context.startActivity(lockIntent)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}