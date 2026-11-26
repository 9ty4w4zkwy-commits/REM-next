# REM hybrid audio
Existing files and maps remain on GitHub. Set chapter.audioSource to "r2" only after uploading and validating the exact audio and word map. Omitted or "github" preserves the local URL.

R2 object keys:
- Montecristo: montecristo/capitolo-21.m4a
- Ovidio: metamorfosi-ovidio/<exact MP3 filename>; timeline.parts determines the order. Every text chapter of the same audio book must use the same source and part durations.
- La bella estate: la-bella-estate/capitolo-01.m4a
- Pinocchio: pinocchio/capitolo-01.m4a

Maps stay at existing GitHub paths. New book IDs need their own player or explicit generic integration. Never publish audioSource=r2 before corresponding files and maps exist. Do not store secrets in catalog. The public read-only Worker serves audio; bucket itself remains private. Upload immutable filenames. A changed recording requires regenerated maps.
