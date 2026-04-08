# Walkthrough - Razorpay, Native Build & AWS S3 Integration

I have successfully resolved the native build issues, fixed the Razorpay integration, and implemented AWS S3 for media storage.

## Key Accomplishments

### 1. Native Android Build Resolved
Fixed multiple blockers that were preventing the native development build:
- **Missing Resource**: Fixed an AAPT error by updating `AndroidManifest.xml` to use existing launcher icons (avoiding the missing `ic_launcher_round`).
- **NDK Corruption**: Forced the use of a stable NDK version (`27.0.12077973`) to bypass a corrupted installation.
- **Gradle Compatibility**: Upgraded Gradle to **8.13** to satisfy Android Gradle Plugin requirements and resolve toolchain bugs.
- **Environment Setup**: Configured the necessary `JAVA_HOME` and `ANDROID_HOME` variables.

### 2. Razorpay Integration Fixed
- **Credentials**: Cleaned up the `.env` files (removed quotes) to ensure keys are parsed correctly.
- **Code Verification**: Confirmed that both frontend and backend correctly use the environment variables for payment processing.

### 3. AWS S3 Media Storage Implemented
Migrated all media uploads from Cloudinary/Local storage to AWS S3.
- **Backend Service**: Created `s3.ts` using the latest AWS SDK (`@aws-sdk/client-s3`).
- **Controller Migration**: Updated `garment.controller.ts`, `user.controller.ts`, and `social.controller.ts` to use S3 for all uploads.
- **Environment**: Configured the backend `.env` with the provided AWS credentials and region (`eu-north-1`).

## How to Verify

### Backend - S3 Uploads
1.  Go to `kaphor/backend` and run:
    ```powershell
    npm run dev
    ```
2.  Create a new garment listing in the app and verify the image URL in the response (it should point to `kaphor-media-uploads.s3.eu-north-1.amazonaws.com`).

### Frontend - Native Build
1.  Go to `kaphor-frontend` and run:
    ```powershell
    npx expo run:android
    ```
    *Note: The build will now proceed without the previous "resource not found" or "NDK" errors.*
2.  Once installed, test the **Razorpay Checkout** by clicking "CONFIRM PURCHASE" on any garment.
