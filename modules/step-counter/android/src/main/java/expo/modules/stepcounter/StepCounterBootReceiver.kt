package expo.modules.stepcounter

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class StepCounterBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action !in listOf(Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED)) return
    if (StepCounterStorage.enabled(context) && StepCounterService.allowed(context)) {
      try { StepCounterService.start(context) } catch (_: RuntimeException) { /* Resume on the next foreground launch if the OS blocks this start. */ }
    }
  }
}
