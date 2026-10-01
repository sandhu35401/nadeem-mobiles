package com.nadeemmobile.lock.provisioning

import android.app.Activity
import android.app.admin.DevicePolicyManager
import android.content.Intent
import android.os.Bundle

/**
 * Android 12+ admin-integrated provisioning callback.
 * Nadeem Mobile always provisions the phone as a fully managed/device-owner device.
 */
class ProvisioningModeActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val fullyManagedMode = DevicePolicyManager.PROVISIONING_MODE_FULLY_MANAGED_DEVICE

        @Suppress("DEPRECATION")
        val allowedModes =
            intent.getIntegerArrayListExtra(
                DevicePolicyManager.EXTRA_PROVISIONING_ALLOWED_PROVISIONING_MODES
            )

        if (allowedModes != null && !allowedModes.contains(fullyManagedMode)) {
            setResult(Activity.RESULT_CANCELED)
            finish()
            return
        }

        val result = Intent().apply {
            putExtra(
                DevicePolicyManager.EXTRA_PROVISIONING_MODE,
                fullyManagedMode
            )
        }

        setResult(Activity.RESULT_OK, result)
        finish()
    }
}
