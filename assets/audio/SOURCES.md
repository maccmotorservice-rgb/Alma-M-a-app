# Angelic choir source, v61

The original 32-second wordless choir performance is rendered from GeneralUser GS v2.0.3, by S. Christian Collins, using its Choir Aahs and Voice Oohs presets. No third-party song or melody is used.

- Project: https://www.schristiancollins.com/generaluser
- Repository: https://github.com/mrbumpy409/GeneralUser-GS
- Pinned commit: 684543d5e5efaef08d02be50dcda8d552478fa60
- SoundFont SHA-256: 9575028c7a1f589f5770fccc8cff2734566af40cd26ed836944e9a5152688cfe
- License: GeneralUser GS License v2.0, supplied in full alongside this source.

The license expressly permits unrestricted private or commercial music creation and profit from musical recordings created with GeneralUser GS. The browser receives only the completed musical mix, not a SoundFont or individual instrument sample bank.

Composition: E major / C-sharp minor / A major / B suspended, with slow consonant vocal voicings. The render uses slow envelopes, a 190–3100 Hz vocal filter, independent stereo diffuse reverberation (about 79% wet), and a quiet spatial echo. The choir stem is stereo PCM16 at 24 kHz, 32 seconds, prepared for circular playback.

The rendering script requires FluidSynth and the upstream SoundFont only at build time; the application requires neither to play the prepared recording.

The recorded musical performance is kept in `source/angelic-choir-v61.wav` for rebuilding. The final mix, `welcome-angelic-zen-v61.wav`, combines it with an original locally synthesized pad, warm bass and eight quiet felt-piano notes. The choir is mixed below the instrumental bed. Run `node scripts/build-welcome-audio.mjs` from the repository root to rebuild the complete mix without installing FluidSynth or downloading the SoundFont.
