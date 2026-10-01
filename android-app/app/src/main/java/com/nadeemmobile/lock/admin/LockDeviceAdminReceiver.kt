package com.nadeemmobile.lock.admin

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent
import com.nadeemmobile.lock.store.Prefs.customerId

class LockDeviceAdminReceiver : DeviceAdminReceiver() {

    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)

        // If a previously paired installation is provisioned as Device Owner,
        // immediately restore its enrollment protections.
        if (PolicyManager.isDeviceOwner(context) && context.customerId != -1) {
            runCatching {
                PolicyManager.applyPermanentProtections(context)
            }
        }
    }

    override fun onProfileProvisioningComplete(context: Context, intent: Intent) {
        super.onProfileProvisioningComplete(context, intent)

        // The OS has now made this app Device Owner. Do not lock the phone
        // before the shop pairing step has supplied a customer record.
        if (PolicyManager.isDeviceOwner(context) && context.customerId != -1) {
            runCatching {
                PolicyManager.applyPermanentProtections(context)
            }
        }
    }

    override fun onDisableRequested(context: Context, intent: Intent): CharSequence {
        return "Removing this will stop the phone from being protected under the installment agreement."
    }
}
