package com.nadeemmobile.lock

import com.nadeemmobile.lock.BuildConfig

/**
 * Production configuration for the Android client.
 *
 * The customer never enters the backend address. It is compiled into the app
 * and should point to the public HTTPS backend used by Nadeem Mobiles.
 */
object AppConfig {
    const val SHOP_NAME = "Nadeem Mobiles"

    /**
     * Set `nadeemApiBaseUrl` in android-app/gradle.properties before a release
     * build. The build falls back to a clearly marked placeholder so the app
     * cannot accidentally point at a developer's laptop.
     */
    val API_BASE_URL: String = BuildConfig.NADEEM_API_BASE_URL

    /**
     * Optional Google account used for Android Factory Reset Protection (FRP).
     * Leave blank when you do not want the extra FRP layer.
     */
    const val SHOP_GOOGLE_ACCOUNT_EMAIL = ""
}
