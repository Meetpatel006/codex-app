# Mobile App CI/CD Setup

## Overview

This workflow builds the Android app using EAS (Expo Application Services) and creates GitHub releases on tags.

## Requirements

### 1. Expo Account

- You need an Expo account
- Create an Expo token: https://expo.dev/settings/access-tokens

### 2. GitHub Secrets

Add these secrets in your repository Settings > Secrets and variables > Actions:

| Secret       | Value           | Description             |
| ------------ | --------------- | ----------------------- |
| `EXPO_TOKEN` | Your Expo token | Required for EAS builds |

### 3. EAS Build Profile

Make sure you have `eas.json` configured in `apps/mobile/`:

```json
{
  "build": {
    "release": {
      "android": {
        "buildType": "release"
      }
    }
  }
}
```

## Usage

### Trigger Builds

- **Push to main**: Runs lint, typecheck, and builds Android
- **Create tag**: Creates a GitHub release with APK

### Creating a Release

```bash
git tag v1.0.0
git push origin v1.0.0
```

## Jobs

1. **lint** - Runs ESLint on the mobile app
2. **typecheck** - Runs TypeScript type checking
3. **build-android** - Builds Android APK using EAS
4. **create-release** - Creates GitHub release (only on tags)

## Troubleshooting

### Long Path Issues (Windows)

If you encounter path length issues, ensure Git long paths are enabled:

```bash
git config --global core.longpaths true
```

### EAS Build Fails

1. Run `eas build --platform android` locally first to set up credentials
2. Check EAS dashboard for build logs: https://expo.dev/builds
