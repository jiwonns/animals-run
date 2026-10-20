package expo.modules.stepcounter

internal data class StepCounterLedger(val raw: Long = -1, val boot: Int = -1, val day: String = "", val today: Long = 0, val baseline: Boolean = true, val total: Long = 0) {
  fun record(steps: Long, currentBoot: Int, currentDay: String): StepCounterLedger {
    if (steps < 0) return this
    val delta = if (baseline || raw < 0) 0L else if (currentBoot != boot || steps < raw) steps else steps - raw
    return StepCounterLedger(steps, currentBoot, currentDay, (if (day == currentDay) today else 0L) + delta.coerceAtLeast(0), false, total + delta.coerceAtLeast(0))
  }
}
