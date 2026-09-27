package com.nadeemmobile.lock.admin

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent

class LockDeviceAdminReceiver : DeviceAdminReceiver() {

    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
    }

    override fun onDisableRequested(context: Context, intent: Intent): CharSequence {
        return "Removing this will stop the phone from being protected under the installment agreement."
    }
}
