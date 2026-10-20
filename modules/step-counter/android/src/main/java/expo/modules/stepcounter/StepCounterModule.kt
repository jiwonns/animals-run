package expo.modules.stepcounter

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// The foreground health service keeps this sensor activated when the JavaScript app is closed.
class StepCounterModule : Module() {
  private val context: Context?
    get() = appContext.reactContext

  private val sensorManager: SensorManager?
    get() = context?.getSystemService(Context.SENSOR_SERVICE) as? SensorManager

  private fun bootCount(): Int =
    context?.let { Settings.Global.getInt(it.contentResolver, Settings.Global.BOOT_COUNT, -1) } ?: -1

  override fun definition() = ModuleDefinition {
    Name("StepCounter")

    AsyncFunction("startAsync") {
      context?.let { StepCounterService.start(it.applicationContext) } ?: false
    }
    AsyncFunction("stopAsync") {
      context?.let { StepCounterService.stop(it.applicationContext) }
    }
    AsyncFunction("addForegroundAsync") { steps: Double ->
      context?.let { StepCounterStorage.addForeground(it.applicationContext, steps.toLong()) }
    }

    Function("isAvailable") {
      sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null
    }
    Function("getTotalSteps") {
      (context?.let { StepCounterStorage.total(it) } ?: 0L).toDouble()
    }

    // Resolves { steps, bootCount }, or null when the sensor doesn't answer in time
    // (no sensor, or the activity recognition permission isn't granted).
    AsyncFunction("readAsync") { promise: Promise ->
      val manager = sensorManager
      val sensor = manager?.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
      if (manager == null || sensor == null) {
        promise.resolve(null)
      } else {
        val handler = Handler(Looper.getMainLooper())
        var done = false
        val listener = object : SensorEventListener {
          override fun onSensorChanged(event: SensorEvent) {
            if (done) return
            done = true
            manager.unregisterListener(this)
            handler.removeCallbacksAndMessages(null)
            promise.resolve(mapOf("steps" to event.values[0].toDouble(), "bootCount" to bootCount(),
              "todaySteps" to (context?.let { StepCounterStorage.today(it) } ?: 0L).toDouble(),
              "totalSteps" to (context?.let { StepCounterStorage.total(it) } ?: 0L).toDouble()))
          }

          override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
        }
        handler.postDelayed({
          if (!done) {
            done = true
            manager.unregisterListener(listener)
            promise.resolve(null)
          }
        }, READ_TIMEOUT_MS)
        manager.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_NORMAL, handler)
      }
    }
  }

  companion object {
    private const val READ_TIMEOUT_MS = 3000L
  }
}
