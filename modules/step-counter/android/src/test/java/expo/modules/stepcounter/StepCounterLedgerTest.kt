package expo.modules.stepcounter

import org.junit.Assert.assertEquals
import org.junit.Test

class StepCounterLedgerTest {
  @Test fun closedAppAndProcessRestartKeepTheSameCounter() {
    val first = StepCounterLedger().record(5000, 1, "2026-10-20")
    assertEquals(0L, first.today)
    val walking = first.record(5123, 1, "2026-10-20")
    val restored = walking.copy().record(5500, 1, "2026-10-20")
    assertEquals(500L, restored.today)
    assertEquals(500L, restored.total)
    assertEquals(500L, restored.record(5500, 1, "2026-10-20").today)
  }
  @Test fun rebootAndMidnightDoNotLoseTheNewSteps() {
    val before = StepCounterLedger().record(5000, 1, "2026-10-20").record(5100, 1, "2026-10-20")
    assertEquals(130L, before.record(30, 2, "2026-10-20").today)
    assertEquals(130L, before.record(30, 2, "2026-10-20").total)
    assertEquals(5L, before.record(5105, 1, "2026-10-21").today)
    assertEquals(105L, before.record(5105, 1, "2026-10-21").total)
  }
  @Test fun disabledTimeIsNotAddedWhenRecordingResumes() {
    val before = StepCounterLedger().record(5000, 1, "2026-10-20").record(5100, 1, "2026-10-20")
    val enabled = before.copy(baseline = true).record(6000, 1, "2026-10-20")
    assertEquals(100L, enabled.today)
    assertEquals(120L, enabled.record(6020, 1, "2026-10-20").today)
    assertEquals(120L, enabled.record(6020, 1, "2026-10-20").total)
    assertEquals(enabled, enabled.record(-1, 1, "2026-10-20"))
  }
}
