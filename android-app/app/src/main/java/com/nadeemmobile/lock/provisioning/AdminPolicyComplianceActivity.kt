package com.nadeemmobile.lock.provisioning

import android.app.Activity
import android.os.Bundle
import android.content.Intent
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

        // After Android finishes Device Owner provisioning, open the app's
        // pairing screen directly instead of sending the technician to an
        // unrelated home/setup screen.
        val next = Intent(this, com.nadeemmobile.lock.ui.PairingActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        startActivity(next)

        setResult(Activity.RESULT_OK)
        finish()
    }
}
