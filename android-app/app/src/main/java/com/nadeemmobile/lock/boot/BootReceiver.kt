package com.nadeemmobile.lock.boot

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.nadeemmobile.lock.admin.PolicyManager
import com.nadeemmobile.lock.store.Prefs.customerId
import com.nadeemmobile.lock.store.Prefs.isLocked
import com.nadeemmobile.lock.ui.LockActivity

class BootReceiver : BroadcastReceiver() {

    override fun onReceive(
        context: Context,
        intent: Intent?
    ) {
        when (intent?.action) {
            Intent.ACTION_LOCKED_BOOT_COMPLETED -> {
                // Direct Boot can run before credential-protected storage is
                // available. Re-apply kiosk restrictions now, then the normal
                // USER_UNLOCKED path will restore the lock screen UI.
                applyBootPolicy(context)
            }

            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_USER_UNLOCKED -> {
                restoreLock(context)
            }
        }
    }

    private fun applyBootPolicy(context: Context) {
        if (!PolicyManager.isDeviceOwner(context) || context.customerId == -1) {
            return
        }

        runCatching {
            PolicyManager.applyPermanentProtections(context)
        }

        if (context.isLocked) {
            runCatching {
                PolicyManager.applyLockRestrictions(context)
            }
        }
    }

    private fun restoreLock(context: Context) {
        if (!PolicyManager.isDeviceOwner(context)) {
            return
        }

        // Re-apply enrollment protections on every boot. These persist
        // independently of temporary lock restrictions.
        if (context.customerId != -1) {
            runCatching {
                PolicyManager.applyPermanentProtections(context)
            }
        }

        // If admin already unlocked the device, do not restore the lock.
        if (!context.isLocked) {
            return
        }

        runCatching {
            PolicyManager.applyLockRestrictions(context)
        }

        val lockIntent = Intent(
            context,
            LockActivity::class.java
        ).apply {
            flags =
                Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_CLEAR_TASK or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP
        }

        runCatching {
            context.startActivity(lockIntent)
        }
    }
}
