package expo.modules.stepcounter

import android.content.Context
import android.provider.Settings
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

internal object StepCounterStorage {
  private fun prefs(context: Context) = context.getSharedPreferences("animals_run_steps", Context.MODE_PRIVATE)
  fun enabled(context: Context) = prefs(context).getBoolean("enabled", false)
  @Synchronized fun setEnabled(context: Context, enabled: Boolean) {
    val p = prefs(context)
    val editor = p.edit().putBoolean("enabled", enabled)
    if (enabled && !p.getBoolean("enabled", false)) editor.putBoolean("baseline", true)
    editor.commit()
  }
  @Synchronized fun record(context: Context, steps: Long) {
    val p = prefs(context)
    val boot = Settings.Global.getInt(context.contentResolver, Settings.Global.BOOT_COUNT, -1)
    val day = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
    val before = StepCounterLedger(p.getLong("steps", -1), p.getInt("boot", -1), p.getString("day", "") ?: "", p.getLong("today", 0), p.getBoolean("baseline", true), p.getLong("total", 0))
    val after = before.record(steps, boot, day)
    p.edit().putLong("steps", steps).putInt("boot", boot).putString("day", day)
      .putLong("today", after.today).putLong("total", after.total).putBoolean("baseline", false).apply()
  }
  @Synchronized fun today(context: Context): Long {
    val day = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
    val p = prefs(context)
    return if (p.getString("day", "") == day) p.getLong("today", 0) else 0L
  }
  @Synchronized fun addForeground(context: Context, steps: Long) {
    if (steps <= 0) return
    val day = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
    prefs(context).edit().putString("day", day).putLong("today", today(context) + steps).apply()
  }
  @Synchronized fun total(context: Context): Long = prefs(context).getLong("total", 0)
}
