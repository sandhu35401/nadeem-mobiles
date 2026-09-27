package com.nadeemmobile.lock

import android.app.Application

class LockApp : Application() {
    override fun onCreate() {
        super.onCreate()
        // Nothing to initialize yet; kept as a hook for future setup
        // (e.g. crash reporting) without touching the manifest again.
    }
}
