# README

## Overview

This repository contains two Cloud Functions (`gmailNotificationHandler` and `establishGmailWatch`) that integrate Gmail with Google Cloud Pub/Sub, Google Cloud Secret Manager, Google Cloud Storage, and Discord. These functions are designed to automatically handle incoming Gmail notifications and perform actions such as extracting email content, sanitizing HTML, saving to Cloud Storage, and sending notifications to Discord.

## Prerequisites

Before using the code, you'll need the following:

- A Google Cloud project with the following APIs enabled:
  - Secret Manager API
  - Cloud Storage API
  - Cloud Pub/Sub API
  - Gmail API

- Two secrets in Google Cloud Secret Manager:
  - `OAUTH_CREDENTIALS`: OAuth 2.0 credentials for Gmail API access
  - `DISCORD_WEBHOOK_URL`: Discord webhook URL to send notifications

- A Discord server with a webhook set up

- An OAuth 2.0 client ID and client secret with appropriate access to the Gmail API

## Function Descriptions

### `gmailNotificationHandler(event, context)`

This Cloud Function handles Pub/Sub notifications from Gmail. It does the following:

- Accesses OAuth 2.0 credentials and Discord webhook URL from Secret Manager
- Fetches the most recent unread email from the user's Gmail account
- Extracts the email details (subject, sender, body, etc.)
- Performs various HTML manipulations (e.g., removing certain elements, decoding MIME parts)
- Checks whether the email satisfies certain conditions
- If conditions are met, saves the sanitized email HTML to Google Cloud Storage
- Creates a Discord embed and sends a notification to the specified Discord webhook

### `establishGmailWatch(req, res)`

This Cloud Function re-establishes a Gmail watch on the user's inbox. It does the following:

- Accesses OAuth 2.0 credentials from Secret Manager
- Sets up the Gmail API client
- Establishes a Gmail watch on the user's inbox for new emails, using a Cloud Pub/Sub topic

## Usage

1. Deploy the Cloud Functions to your Google Cloud project.
2. Set up a Gmail watch using the `establishGmailWatch` Cloud Function to start receiving notifications.
3. Use the `gmailNotificationHandler` Cloud Function as the Cloud Pub/Sub subscription handler for incoming Gmail notifications.

## Notes

- The Cloud Function `gmailNotificationHandler` is designed to check for emails with specific characteristics (e.g., presence of certain text in the sender address or header value). You may need to customize this logic to suit your use case.

- The OAuth 2.0 credentials in Secret Manager should have the necessary permissions to access the Gmail API, including reading and modifying email messages.

- The `saveHtmlStringToCloudStorage` function saves the email HTML to a Google Cloud Storage bucket named `travel-alerts`. You may need to modify the bucket name if you want to use a different one.

## Dependencies

This code uses the following npm packages:

- `@google-cloud/secret-manager`
- `@google-cloud/storage`
- `googleapis`
- `axios`
- `jsdom`

Please ensure these packages are installed before running the code.

## Contributing

Contributions are welcome! Please create an issue or submit a pull request for any changes or enhancements.

## License

This project is licensed under the MIT License. Please see the `LICENSE` file for more details.
