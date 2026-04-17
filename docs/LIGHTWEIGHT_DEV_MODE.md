# Lightweight Dev Mode

Use lightweight dev mode when Expo or Metro is consuming too much memory during local development.

## Commands

- `npm run start:light`
- `npm run ios:light`
- `npm run android:light`

## What it changes

- Caps the Node heap at 2 GB with `NODE_OPTIONS=--max-old-space-size=2048`.
- Disables Expo telemetry for that session.
- Enables Expo's fast resolver.
- Starts Metro on `lan` instead of tunnel.
- Limits Metro worker count to 2 for the lightweight start path.
- Sets `EXPO_PUBLIC_LIGHTWEIGHT_DEV=1` so the app skips heavy development startup work.

## App behavior in lightweight mode

- Skips Sentry initialization.
- Skips analytics initialization.
- Skips experiment initialization.
- Skips RevenueCat initialization.
- Skips push registration wiring.
- Skips notification deep-link bootstrap.
- Still runs decrypted-cache auto-clear registration.

## When to use it

- Your Mac is under memory pressure while Metro is running.
- You need a fast UI iteration loop and do not need push flows, paywall testing, or crash telemetry.
- You are working mostly on screens, styling, navigation structure, or local state.

## When not to use it

- You are testing purchases.
- You are testing push notifications or notification routing.
- You are debugging Sentry or analytics behavior.