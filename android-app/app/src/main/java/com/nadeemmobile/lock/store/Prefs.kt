package com.nadeemmobile.lock.store

import android.content.Context

/**
 * Local device state. The enrollment state and lock state are deliberately
 * persisted so a reboot cannot bypass the management policy.
 */
object Prefs {
    private const val FILE = "nadeem_lock_prefs"

    private fun prefs(context: Context) =
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    var Context.customerId: Int
        get() = prefs(this).getInt("customer_id", -1)
        set(v) = prefs(this).edit().putInt("customer_id", v).apply()

    val Context.isPaired: Boolean
        get() = customerId != -1

    var Context.deviceSecret: String
        get() = prefs(this).getString("device_secret", "") ?: ""
        set(v) = prefs(this).edit().putString("device_secret", v).apply()

    var Context.isLocked: Boolean
        get() = prefs(this).getBoolean("is_locked", false)
        set(v) = prefs(this).edit().putBoolean("is_locked", v).apply()

    var Context.lockMessage: String
        get() = prefs(this).getString("lock_message", "") ?: ""
        set(v) = prefs(this).edit().putString("lock_message", v).apply()

    var Context.shopName: String
        get() = prefs(this).getString("shop_name", "Nadeem Mobiles") ?: "Nadeem Mobiles"
        set(v) = prefs(this).edit().putString("shop_name", v).apply()

    var Context.shopPhone: String
        get() = prefs(this).getString("shop_phone", "") ?: ""
        set(v) = prefs(this).edit().putString("shop_phone", v).apply()

    fun clearEnrollment(context: Context) {
        prefs(context).edit()
            .remove("customer_id")
            .remove("device_secret")
            .remove("is_locked")
            .remove("lock_message")
            .remove("shop_name")
            .remove("shop_phone")
            .apply()
    }
}
