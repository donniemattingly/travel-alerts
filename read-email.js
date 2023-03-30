const {google} = require('googleapis');
const {SecretManagerServiceClient} = require('@google-cloud/secret-manager');
const he = require('he');
const URLSafeBase64 = require('urlsafe-base64');
// Project ID and secret name
const projectId = 'parledger-app';
const secretName = 'OAUTH_CREDENTIALS';

// Create a Secret Manager client
const client = new SecretManagerServiceClient();

const extractLinkWithText = (htmlString, linkText) => {
    // Define a regular expression pattern to extract the link with the specified link text
    const regex = new RegExp(`<a[^>]*href="([^"]*)"[^>]*>${linkText}</a>`, 'i');
    const match = htmlString.match(regex);
    return match ? match[1] : '';
};

const getExampleSearchLink = (htmlString) => {
    const result = extractLinkWithText(htmlString, 'view example search');
    const part = result.split('/').pop();
    const decodedString = Buffer.from(part, 'base64').toString('utf8');
    const regex = /\u0001(.*?)\u0003/;
    const match = decodedString.match(regex);
    // Extract the matched text (if any)
    return match ? match[1] : '';
}

const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const removeElementByClassName = (htmlContent, className) => {
    // Parse the HTML content using jsdom
    const dom = new JSDOM(htmlContent);

    // Get the first element with the specified class name
    const elementToRemove = dom.window.document.querySelector(`.${className}`);

    // If the element is found, remove it from the DOM
    if (elementToRemove) {
        elementToRemove.remove();
    }

    // Serialize the modified DOM back to an HTML string
    return dom.serialize();
};

const { Storage } = require('@google-cloud/storage');
const storage = new Storage();

const saveHtmlStringToCloudStorage = async (bucketName, fileName, htmlString) => {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);
    const writeStream = file.createWriteStream();
    writeStream.write(htmlString);
    writeStream.end();
    return new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
    });
};

async function getLastEmail() {
    try {
        // Get the OAuth credentials from Secret Manager
        const [version] = await client.accessSecretVersion({
            name: `projects/${projectId}/secrets/${secretName}/versions/latest`,
        });
        const credentials = JSON.parse(version.payload.data.toString());

        // Extract OAuth 2.0 credentials from the secret
        const clientId = credentials.client_id;
        const clientSecret = credentials.client_secret;
        const refreshToken = credentials.refresh_token;

        // Set up the OAuth2 client with the refresh token
        const oauth2Client = new google.auth.OAuth2(
            clientId,
            clientSecret
        );
        oauth2Client.setCredentials({refresh_token: refreshToken});

        // Set up the Gmail API client
        const gmail = google.gmail({
            version: 'v1',
            auth: oauth2Client,
        });

        // List emails and get the most recent one
        const res = await gmail.users.messages.list({
            userId: 'me',
            maxResults: 1, // Limit the results to 1 message
            orderBy: 'internalDate', // Order by internal date
        });

        const messages = res.data.messages;
        if (!messages || messages.length === 0) {
            console.log('No messages found.');
            return;
        }

        // Get the most recent message (first in the list)
        const messageId = messages[0].id;

        // Get the details of the specific email using the message ID
        const email = await gmail.users.messages.get({
            userId: 'me',
            id: messageId,
        });

        // Function to recursively decode and print MIME parts
        const decodeAndPrintParts = (parts) => {
            for (const part of parts) {
                if (part.mimeType === 'text/plain' || part.mimeType === 'text/html') {
                    const decodedPart = Buffer.from(part.body.data, 'base64').toString('utf8');
                    return decodedPart;
                }
            }
        };

        // Get the payload and MIME parts
        const payload = email.data.payload;
        const parts = [payload.parts[1]] || [];

        // Decode and print the parts
        const decoded = decodeAndPrintParts(parts);
        const htmlWithMetaTag = `
        <!DOCTYPE html>
        <html>
        <head>
        <meta charset="UTF-8">
        </head>
        <body>
        ${decoded}
        </body>
        </html>
        `;

        const sanitized = removeElementByClassName(htmlWithMetaTag, 'gmail_attr');

        const randomFileName = `file-${Math.random().toString(36).substr(2, 9)}.html`;
        await saveHtmlStringToCloudStorage('travel-alerts', randomFileName, sanitized);

        console.log(`https://storage.googleapis.com/travel-alerts/${randomFileName}`);
    } catch (error) {
        console.error(error);
    }
}

getLastEmail();
