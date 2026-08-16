package com.aacreativeemb.support.data.api

import android.content.Context
import com.aacreativeemb.support.data.local.PreferencesManager
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object ApiClient {

    private const val DEFAULT_BASE_URL = "https://chat.aacreativeemb.com/"

    @Volatile
    private var apiService: ApiService? = null

    fun getInstance(context: Context): ApiService {
        return apiService ?: synchronized(this) {
            apiService ?: buildRetrofit(context).create(ApiService::class.java).also {
                apiService = it
            }
        }
    }

    private fun buildRetrofit(context: Context): Retrofit {
        val prefs = PreferencesManager(context)

        val authInterceptor = Interceptor { chain ->
            val original = chain.request()
            val builder = original.newBuilder()

            val token = prefs.getAuthToken()
            if (!token.isNullOrEmpty()) {
                builder.header("Authorization", "Bearer $token")
            }

            builder.header("Accept", "application/json")
            builder.header("User-Agent", "AACreativeSupport-Android/1.0")

            chain.proceed(builder.build())
        }

        val loggingInterceptor = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }

        val okHttpClient = OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(loggingInterceptor)
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .writeTimeout(20, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .build()

        return Retrofit.Builder()
            .baseUrl(DEFAULT_BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }
}
