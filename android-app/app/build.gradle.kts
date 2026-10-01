plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.gms.google-services")
}

android {
    namespace = "com.nadeemmobile.lock"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.nadeemmobile.lock"
        minSdk = 26
        targetSdk = 34
        versionCode = 2
        versionName = "2.0"

        val apiBaseUrl = providers.gradleProperty("nadeemApiBaseUrl")
            .orElse("https://YOUR-BACKEND-DOMAIN.example")
        buildConfigField("String", "NADEEM_API_BASE_URL", "\"${apiBaseUrl.get()}\"")
    }

    buildFeatures {
        buildConfig = true
    }

    signingConfigs {
        create("release") {
            val keystorePath = providers.gradleProperty("nadeemKeystorePath").orNull
            if (!keystorePath.isNullOrBlank()) {
                storeFile = file(keystorePath)
            }
            storePassword = providers.gradleProperty("nadeemStorePassword").orNull
            keyAlias = providers.gradleProperty("nadeemKeyAlias").orNull ?: "nadeemmobile"
            keyPassword = providers.gradleProperty("nadeemKeyPassword").orNull
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false

            val keystorePath = providers.gradleProperty("nadeemKeystorePath").orNull
            signingConfig = if (keystorePath.isNullOrBlank()) {
                // Development-safe fallback. Configure a real keystore for a production APK.
                signingConfigs.getByName("debug")
            } else {
                signingConfigs.getByName("release")
            }

            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")

    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.8.1")

    implementation(platform("com.google.firebase:firebase-bom:33.1.2"))
    implementation("com.google.firebase:firebase-messaging-ktx")
}