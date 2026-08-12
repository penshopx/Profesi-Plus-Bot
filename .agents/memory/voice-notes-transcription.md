---
name: Voice notes transcription
description: Whisper transcription endpoint setup and mobile recording upload pattern.
---

**Server:** `POST /api/transcribe` — multer memory storage, single `audio` field, 25 MB limit. Converts the buffer to an OpenAI `File` object using `toFile(buffer, name, { type: mimetype })` from the `openai` package, then calls `client.audio.transcriptions.create({ file, model: "whisper-1", language: "id" })`.

**Why multer memory (not disk):** Voice clips are short (< 5 MB typical); disk storage adds cleanup complexity.

**Mobile upload:** Use the native `fetch` (not `expo/fetch`) for multipart FormData — expo/fetch is for streaming responses. Append the audio as `{ uri, type: "audio/m4a", name: "voice-note.m4a" }` cast to `Blob`.

**Recording SDK 54:** `expo-av@~15.0.0`. Pattern: `Audio.setAudioModeAsync({ allowsRecordingIOS: true })` before starting, reset to false after stopping. Use `Audio.RecordingOptionsPresets.HIGH_QUALITY`.

**Auth token:** transcribeAudio receives the Clerk bearer token explicitly (passed from `useAuth().getToken()`) because it's a one-off call outside the usual apiFetch wrapper.
