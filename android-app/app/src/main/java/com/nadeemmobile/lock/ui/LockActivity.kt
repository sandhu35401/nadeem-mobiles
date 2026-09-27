package com.nadeemmobile.lock.ui

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowInsets
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.nadeemmobile.lock.R
import com.nadeemmobile.lock.admin.PolicyManager
import com.nadeemmobile.lock.store.Prefs.isLocked
import com.nadeemmobile.lock.store.Prefs.lockMessage
import com.nadeemmobile.lock.store.Prefs.shopName
import com.nadeemmobile.lock.store.Prefs.shopPhone

class LockActivity : AppCompatActivity() {

    companion object {
        const val ACTION_UNLOCK =
            "com.nadeemmobile.lock.ACTION_UNLOCK"
    }

    private val unlockReceiver = object : BroadcastReceiver() {

        override fun onReceive(
            context: Context?,
            intent: Intent?
        ) {
            if (intent?.action == ACTION_UNLOCK) {
                finishAndUnlock()
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // If device is not locked, do not show lock screen.
        if (!isLocked) {
            finish()
            return
        }

        setContentView(R.layout.activity_lock)

        setupLockScreen()
        registerUnlockReceiver()
        hideSystemBars()
        startLockTaskIfPossible()
    }

    override fun onResume() {
        super.onResume()
        if (!isLocked) {
            runCatching { stopLockTask() }
            finish()
        }
    }

    private fun setupLockScreen() {

        val lockTitle =
            findViewById<TextView>(R.id.lockTitle)

        val lockMessageView =
            findViewById<TextView>(R.id.lockMessage)

        val callShopButton =
            findViewById<Button>(R.id.callShopButton)

        // Shop name
        lockTitle.text =
            getString(
                R.string.locked_by_format,
                shopName
            )

        // Lock message
        lockMessageView.text =
            lockMessage.ifBlank {
                getString(
                    R.string.lock_default_message
                )
            }

        // Call shop button
        if (shopPhone.isBlank()) {

            callShopButton.visibility = View.GONE

        } else {

            callShopButton.visibility = View.VISIBLE

            callShopButton.text =
                getString(
                    R.string.lock_call_button_format,
                    shopPhone
                )

            callShopButton.setOnClickListener {

                val intent =
                    Intent(
                        Intent.ACTION_DIAL,
                        Uri.parse("tel:$shopPhone")
                    )

                try {
                    startActivity(intent)
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
    }

    private fun registerUnlockReceiver() {

        ContextCompat.registerReceiver(
            this,
            unlockReceiver,
            IntentFilter(ACTION_UNLOCK),
            ContextCompat.RECEIVER_NOT_EXPORTED
        )
    }

    private fun hideSystemBars() {

        window.addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        )

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {

            window.insetsController?.hide(
                WindowInsets.Type.statusBars() or
                        WindowInsets.Type.navigationBars()
            )

        } else {

            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility =
                View.SYSTEM_UI_FLAG_FULLSCREEN or
                        View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                        View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        }
    }

    private fun startLockTaskIfPossible() {

        // Must be Device Owner.
        if (!PolicyManager.isDeviceOwner(this)) {
            return
        }

        // Apply restrictions while locked.
        try {
            PolicyManager.applyLockRestrictions(this)
        } catch (e: Exception) {
            e.printStackTrace()
        }

        // Enter Lock Task mode.
        try {
            startLockTask()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun finishAndUnlock() {

        // Remove temporary restrictions.
        try {
            PolicyManager.clearLockRestrictions(this)
        } catch (e: Exception) {
            e.printStackTrace()
        }

        // Exit Lock Task mode.
        try {
            stopLockTask()
        } catch (_: Exception) {
        }

        // Close lock screen.
        finish()
    }

    override fun onDestroy() {

        try {
            unregisterReceiver(unlockReceiver)
        } catch (_: Exception) {
        }

        super.onDestroy()
    }

    @Suppress("DEPRECATION")
    override fun onBackPressed() {
        // Back button blocked while device is locked.
    }
}