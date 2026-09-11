# SongMatch MVP

A zero-backend browser prototype for the singing app concept.

## What works
- Microphone permission + live pitch detection in-browser
- Live note / Hz / cents feedback
- 20-second-style voice scan flow
- Usable-range estimate
- SongMatch results with match scores, key and rationale
- Responsive consumer-app UI

## What is intentionally mocked
- Song catalog metadata
- Personalized ranking model
- Karaoke/backing-track playback
- Accounts/subscriptions
- Cloud persistence

## Run
Open `index.html` in a modern browser. For microphone access, browsers may require HTTPS or localhost:
`python3 -m http.server 8000`
Then visit `http://localhost:8000`.

## Production next step
Move the pitch profile and song metadata into a backend, replace demo ranking with the SongMatch scoring engine, then add licensed karaoke audio and real-time scoring.
