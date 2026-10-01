package com.nadeemmobile.lock.provisioning

import android.app.Activity
import android.os.Bundle
import com.nadeemmobile.lock.admin.PolicyManager
import com.nadeemmobile.lock.store.Prefs.customerId

/**
 * Called by Android setup during managed-device provisioning.
 * Device-owner enrollment is established by the OS; Nadeem applies the
 * enrollment restrictions only after the customer record is paired.
 */
class AdminPolicyComplianceActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (PolicyManager.isDeviceOwner(this) && customerId != -1) {
            runCatching {
                PolicyManager.applyPermanentProtections(this)
            }
        }

        setResult(Activity.RESULT_OK)
        finish()
    }
}
