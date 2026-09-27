package com.nadeemmobile.lock.ui

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.view.inputmethod.InputMethodManager
import android.content.Context
import android.widget.EditText
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Button
import androidx.appcompat.app.AppCompatActivity
import com.google.firebase.messaging.FirebaseMessaging
import com.nadeemmobile.lock.AppConfig
import com.nadeemmobile.lock.R
import com.nadeemmobile.lock.admin.PolicyManager
import com.nadeemmobile.lock.net.ApiClient
import com.nadeemmobile.lock.store.Prefs.customerId
import com.nadeemmobile.lock.store.Prefs.deviceSecret
import com.nadeemmobile.lock.store.Prefs.isLocked
import com.nadeemmobile.lock.store.Prefs.shopName
import com.nadeemmobile.lock.store.Prefs.shopPhone
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext

class PairingActivity : AppCompatActivity() {

    private val scope = CoroutineScope(Dispatchers.Main)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // A locked phone must always return to the lock screen.
        if (isLocked) {
            startActivity(Intent(this, LockActivity::class.java))
            finish()
            return
        }

        setContentView(R.layout.activity_pairing)

        val codeInput = findViewById<EditText>(R.id.pairingCodeInput)
        val statusText = findViewById<TextView>(R.id.pairingStatus)
        val pairButton = findViewById<Button>(R.id.pairButton)
        val progress = findViewById<ProgressBar>(R.id.pairingProgress)

        // Already enrolled: never show pairing controls again.
        if (customerId != -1) {
            showPairedScreen(codeInput, pairButton, progress, statusText)
            // Silent migration/heartbeat for devices enrolled by the previous build.
            scope.launch(Dispatchers.IO) {
                runCatching {
                    val token = FirebaseMessaging.getInstance().token.await()
                    ApiClient.sendHeartbeat(this@PairingActivity, token)
                }
            }
            return
        }

        if (!PolicyManager.isDeviceOwner(this)) {
            statusText.text = getString(R.string.pairing_not_device_owner)
            pairButton.isEnabled = false
            return
        }

        codeInput.requestFocus()
        window.setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE)

        pairButton.setOnClickListener {
            val code = codeInput.text.toString().trim()
            if (code.length != 6 || code.any { !it.isDigit() }) {
                statusText.text = getString(R.string.pairing_invalid_code)
                return@setOnClickListener
            }

            pairButton.isEnabled = false
            progress.visibility = View.VISIBLE
            statusText.text = getString(R.string.pairing_connecting)
            hideKeyboard(codeInput)

            scope.launch {
                try {
                    val token = FirebaseMessaging.getInstance().token.await()
                    val result = withContext(Dispatchers.IO) {
                        ApiClient.pairDevice(this@PairingActivity, code, token)
                    }

                    customerId = result.getInt("customerId")
                    deviceSecret = result.getString("deviceSecret")
                    shopName = AppConfig.SHOP_NAME
                    shopPhone = result.optString("shopPhone", "")

                    // From this moment, reset and uninstall remain blocked until release.
                    PolicyManager.applyPermanentProtections(
                        this@PairingActivity,
                        AppConfig.SHOP_GOOGLE_ACCOUNT_EMAIL.ifBlank { null }
                    )

                    showPairedScreen(codeInput, pairButton, progress, statusText)
                } catch (e: Exception) {
                    progress.visibility = View.GONE
                    pairButton.isEnabled = true
                    statusText.text = getString(
                        R.string.pairing_failed,
                        e.message ?: "Please check the code and try again."
                    )
                }
            }
        }
    }

    private fun showPairedScreen(
        codeInput: EditText,
        pairButton: Button,
        progress: ProgressBar,
        statusText: TextView
    ) {
        codeInput.visibility = View.GONE
        pairButton.visibility = View.GONE
        progress.visibility = View.GONE
        statusText.text = getString(R.string.pairing_success)
        statusText.setTextColor(getColor(R.color.good))
    }

    private fun hideKeyboard(view: View) {
        val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
        imm.hideSoftInputFromWindow(view.windowToken, 0)
    }
}
