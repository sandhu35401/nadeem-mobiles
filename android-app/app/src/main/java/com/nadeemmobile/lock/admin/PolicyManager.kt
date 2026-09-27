package com.nadeemmobile.lock.admin

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.os.Build
import android.os.UserManager

object PolicyManager {

    fun adminComponent(context: Context): ComponentName =
        ComponentName(context, LockDeviceAdminReceiver::class.java)

    private fun dpm(context: Context): DevicePolicyManager =
        context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager

    fun isDeviceOwner(context: Context): Boolean =
        dpm(context).isDeviceOwnerApp(context.packageName)

    /**
     * Protections that stay active for the full enrollment period.
     * In particular, Factory Reset is blocked while the phone is enrolled.
     */
    fun applyPermanentProtections(
        context: Context,
        shopGoogleAccountEmail: String? = null
    ) {
        val manager = dpm(context)
        val admin = adminComponent(context)
        if (!manager.isDeviceOwnerApp(context.packageName)) return

        try {
            // Enrolled devices must not be normally uninstallable.
            manager.setUninstallBlocked(admin, context.packageName, true)

            // Enrolled devices must not expose the normal factory-reset path.
            manager.addUserRestriction(admin, UserManager.DISALLOW_FACTORY_RESET)

            // Keep the app allow-listed for kiosk/lock-task mode.
            manager.setLockTaskPackages(admin, arrayOf(context.packageName))

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                manager.setLockTaskFeatures(
                    admin,
                    DevicePolicyManager.LOCK_TASK_FEATURE_SYSTEM_INFO
                )
            }

            // Optional Android Factory Reset Protection account.
            if (
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.R &&
                !shopGoogleAccountEmail.isNullOrBlank()
            ) {
                try {
                    val frp = android.app.admin.FactoryResetProtectionPolicy
                        .Builder()
                        .setFactoryResetProtectionAccounts(listOf(shopGoogleAccountEmail))
                        .setFactoryResetProtectionEnabled(true)
                        .build()
                    manager.setFactoryResetProtectionPolicy(admin, frp)
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    /** Temporary restrictions that are only needed while the screen is locked. */
    fun applyLockRestrictions(context: Context) {
        val manager = dpm(context)
        val admin = adminComponent(context)
        if (!manager.isDeviceOwnerApp(context.packageName)) return

        try {
            // Factory reset is intentionally NOT temporary; permanent enrollment policy owns it.
            manager.addUserRestriction(admin, UserManager.DISALLOW_SAFE_BOOT)
            manager.addUserRestriction(admin, UserManager.DISALLOW_ADD_USER)
            manager.addUserRestriction(admin, UserManager.DISALLOW_DEBUGGING_FEATURES)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                manager.addUserRestriction(admin, UserManager.DISALLOW_INSTALL_APPS)
                manager.addUserRestriction(admin, UserManager.DISALLOW_INSTALL_UNKNOWN_SOURCES)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                manager.addUserRestriction(admin, UserManager.DISALLOW_USB_FILE_TRANSFER)
            }

            manager.setLockTaskPackages(admin, arrayOf(context.packageName))
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                manager.setLockTaskFeatures(
                    admin,
                    DevicePolicyManager.LOCK_TASK_FEATURE_NONE
                )
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    /** Remove only lock-state restrictions. Enrollment restrictions remain. */
    fun clearLockRestrictions(context: Context) {
        val manager = dpm(context)
        val admin = adminComponent(context)
        if (!manager.isDeviceOwnerApp(context.packageName)) return

        try {
            manager.clearUserRestriction(admin, UserManager.DISALLOW_SAFE_BOOT)
            manager.clearUserRestriction(admin, UserManager.DISALLOW_ADD_USER)
            manager.clearUserRestriction(admin, UserManager.DISALLOW_DEBUGGING_FEATURES)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                manager.clearUserRestriction(admin, UserManager.DISALLOW_INSTALL_APPS)
                manager.clearUserRestriction(admin, UserManager.DISALLOW_INSTALL_UNKNOWN_SOURCES)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                manager.clearUserRestriction(admin, UserManager.DISALLOW_USB_FILE_TRANSFER)
            }

            // Factory reset remains blocked because the device is still enrolled.
            manager.addUserRestriction(admin, UserManager.DISALLOW_FACTORY_RESET)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                manager.setLockTaskFeatures(
                    admin,
                    DevicePolicyManager.LOCK_TASK_FEATURE_SYSTEM_INFO
                )
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    /**
     * Final release sequence. The app becomes uninstallable only after all
     * enrollment restrictions have been cleared and Device Owner is released.
     */
    @Suppress("DEPRECATION")
    fun prepareForRelease(context: Context): Boolean {
        val manager = dpm(context)
        val admin = adminComponent(context)
        if (!manager.isDeviceOwnerApp(context.packageName)) return false

        return try {
            // Stop lock-state restrictions first.
            clearLockRestrictions(context)

            // Release the enrollment-only factory-reset restriction.
            manager.clearUserRestriction(admin, UserManager.DISALLOW_FACTORY_RESET)

            // Allow the package to be removed after Device Owner is gone.
            manager.setUninstallBlocked(admin, context.packageName, false)

            // This API is deprecated and intended mainly for testing/management
            // flows; it is retained here because this project provisions Device
            // Owner manually and needs a controlled release action.
            manager.clearDeviceOwnerApp(context.packageName)

            !manager.isDeviceOwnerApp(context.packageName)
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }
}
