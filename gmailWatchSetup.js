import {google} from "googleapis";
import fs from "fs";

// Example usage
const filePath = 'secrets.json'; // Update with the path to your JSON file
const {clientId, clientSecret} = readSecretsFile(filePath);


// Function to read and parse the JSON file containing the secrets
function readSecretsFile(filePath) {
    try {
        // Read the contents of the JSON file
        const rawJson = fs.readFileSync(filePath, 'utf-8');

        // Parse the JSON file contents
        const secrets = JSON.parse(rawJson);

        // Extract the client ID and client secret
        const clientId = secrets.web.client_id;
        const clientSecret = secrets.web.client_secret;

        return {clientId, clientSecret};
    } catch (error) {
        console.error('Error reading secrets file:', error);
        return null;
    }
}

const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret
);

// Set the refresh token to the OAuth2 client
oauth2Client.setCredentials({refresh_token: refreshToken});

// Set up the Gmail API client
const gmail = google.gmail({
    version: 'v1',
    auth: oauth2Client
});

// The ID of the Pub/Sub topic you created
const pubSubTopic = 'projects/parledger-app/topics/new-going-emails';

// Set up a watch on the Gmail account
gmail.users.watch({
    userId: 'me',
    requestBody: {
        topicName: pubSubTopic,
        labelIds: ['INBOX'] // Optional: specify labels to watch (e.g., INBOX)
    }
}, (err, res) => {
    if (err) {
        console.error('Failed to set up watch:', err);
        return;
    }
    console.log('Watch set up successfully:', res.data);
});
