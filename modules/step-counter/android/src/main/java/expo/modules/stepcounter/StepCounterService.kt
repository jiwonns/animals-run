package expo.modules.stepcounter

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.IBinder

/** Keeps the low-power hardware counter registered when React Native is suspended or closed. */
class StepCounterService : Service(), SensorEventListener {
  private var manager: SensorManager? = null
  private var lastNotification = 0L

  override fun onCreate() {
    super.onCreate()
    if (!StepCounterStorage.enabled(this) || !allowed(this)) { stopSelf(); return }
    val notifications = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= 26) notifications.createNotificationChannel(
      NotificationChannel(CHANNEL, "걸음 기록", NotificationManager.IMPORTANCE_LOW).apply { setShowBadge(false) }
    )
    val notification = notification()
    if (Build.VERSION.SDK_INT >= 34) startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH)
    else startForeground(NOTIFICATION_ID, notification)
    manager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (!StepCounterStorage.enabled(this) || !allowed(this)) { stopSelf(); return START_NOT_STICKY }
    val sensor = manager?.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
    if (sensor == null || manager?.registerListener(this, sensor, SensorManager.SENSOR_DELAY_NORMAL) != true) {
      stopSelf(); return START_NOT_STICKY
    }
    return START_STICKY
  }

  override fun onSensorChanged(event: SensorEvent) {
    StepCounterStorage.record(this, event.values[0].toLong())
    if (System.currentTimeMillis() - lastNotification >= 30000L) {
      lastNotification = System.currentTimeMillis()
      (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify(NOTIFICATION_ID, notification())
    }
  }
  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
  override fun onBind(intent: Intent?): IBinder? = null
  override fun onDestroy() { manager?.unregisterListener(this); super.onDestroy() }

  private fun notification(): Notification {
    val launch = packageManager.getLaunchIntentForPackage(packageName)
    val pending = launch?.let { PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE) }
    val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CHANNEL) else Notification.Builder(this)
    return builder.setSmallIcon(android.R.drawable.ic_menu_mylocation).setContentTitle("Animals Run · 걸음 기록 중")
      .setContentText("오늘 ${StepCounterStorage.today(this)}걸음 · 앱을 닫아도 기록해요")
      .setContentIntent(pending).setOngoing(true).setOnlyAlertOnce(true).setCategory(Notification.CATEGORY_SERVICE).build()
  }

  companion object {
    private const val CHANNEL = "animals_run_steps"
    private const val NOTIFICATION_ID = 4701
    fun allowed(context: Context): Boolean = Build.VERSION.SDK_INT < 29 || context.checkSelfPermission(Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED
    fun start(context: Context): Boolean {
      if (!allowed(context) || (context.getSystemService(Context.SENSOR_SERVICE) as SensorManager).getDefaultSensor(Sensor.TYPE_STEP_COUNTER) == null) return false
      StepCounterStorage.setEnabled(context, true)
      try {
        val intent = Intent(context, StepCounterService::class.java)
        if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent) else context.startService(intent)
      } catch (error: RuntimeException) { StepCounterStorage.setEnabled(context, false); throw error }
      return true
    }
    fun stop(context: Context) {
      StepCounterStorage.setEnabled(context, false)
      context.stopService(Intent(context, StepCounterService::class.java))
    }
  }
}
