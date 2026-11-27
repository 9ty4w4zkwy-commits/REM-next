# Beta usage metrics

Testers can enable reading and listening metrics at onboarding or from their profile, as part of voluntary test participation. The onboarding confirmation covers Ebook and Audio durations, format changes, and the choice between chapters and episodes. The count can be turned off in the profile. Turning off test data collection also clears this option.

- `format_switch` records the book, unit, source and destination formats, and reading path.
- `reading_path_choice` records the book and reading path.
- `usage_session_start` and `usage_session_end` identify a session for one reader unit. The end event includes its total duration.
- `usage_time` sends incremental whole seconds during use and on pause, exit, or visibility changes. Sum these events for time totals and use completed sessions for average duration.

Ebook time estimates visible engagement with a two-minute inactivity cutoff. For recorded audio, the media position and playback rate measure listening time, excluding pauses and seeks. Synthesized speech uses periodic sampling, so suspended browser timers can undercount it. Paper reading time is unavailable.
