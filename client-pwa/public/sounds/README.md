# Sound Files for Advanced Haptic Feedback

This directory should contain the following sound effect files:

## Required Files

- **tap.mp3** - Button tap sound (short, crisp)
- **success.mp3** - Success sound (positive, cheerful)
- **error.mp3** - Error sound (negative, alert)
- **pop.mp3** - Add to cart sound (playful pop)
- **cha-ching.mp3** - Checkout/payment sound (cash register)
- **notification.mp3** - Notification alert (gentle chime)

## Sound Specifications

- Format: MP3 (for broad browser support)
- Duration: 100-500ms (keep them short)
- Size: < 50KB each (optimize for web)
- Sample Rate: 44.1kHz or 48kHz
- Bit Rate: 128kbps recommended

## Free Sound Resources

You can find free sound effects from:
- [Freesound.org](https://freesound.org)
- [Zapsplat](https://www.zapsplat.com)
- [Mixkit](https://mixkit.co/free-sound-effects/)
- [Pixabay Audio](https://pixabay.com/sound-effects/)

## Usage

These sounds are preloaded by the Advanced Haptic Engine (`lib/haptics.ts`) and played automatically during specific user interactions.

## Note

The PWA will work without these files, but the audio feedback will be disabled. Only haptic vibration will be available.
