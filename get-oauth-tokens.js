import open from "open";
import url from "url";
import http from "http";
import {google} from "googleapis";
import fs from "fs";

// Example usage
const filePath = 'secrets.json'; // Update with the path to your JSON file
const {clientId, clientSecret} = readSecretsFile(filePath);

const redirectUri = 'http://localhost:3000/oauth2callback';

const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
);

// Generate the consent page URL
const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.modify']
});

// Open the consent page in the default browser
console.log(authUrl);

// Create a local server to listen for the authorization response
http.createServer(async (req, res) => {
    if (req.url.indexOf('/oauth2callback') === 0) {
        const queryObject = url.parse(req.url, true).query;
        const code = queryObject.code;

        // Request access and refresh tokens using the authorization code
        const {tokens} = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Save the refresh token securely for future use
        const refreshToken = tokens.refresh_token;
        console.log('Refresh Token:', refreshToken);

        res.end('Authorization successful. You can close this window.');
    }
}).listen(3000, () => {
    console.log('Server listening on port 3000');
});


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