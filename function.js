// Secret Manager client
const {SecretManagerServiceClient} = require("@google-cloud/secret-manager");
const {google} = require("googleapis");
const axios = require("axios");
const secretManagerClient = new SecretManagerServiceClient();

// The name of the secret you created
const credentialsSecretName = 'projects/955423843573/secrets/OAUTH_CREDENTIALS/versions/latest';
const webhookSecretName = 'projects/955423843573/secrets/DISCORD_WEBHOOK_URL/versions/latest';

// Helper function to extract header value by name
const getHeaderValueByName = (headers, name) => {
    const header = headers.find(header => header.name.toLowerCase() === name.toLowerCase());
    return header ? header.value : '';
};

const extractLinkWithText = (htmlString, linkText) => {
    // Define a regular expression pattern to extract the link with the specified link text
    const regex = new RegExp(`<a[^>]*href="([^"]*)"[^>]*>${linkText}</a>`, 'i');
    const match = htmlString.match(regex);
    return match ? match[1] : '';
};

const jsdom = require('jsdom');
const {JSDOM} = jsdom;

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

const {Storage} = require('@google-cloud/storage');
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

const getExampleSearchLink = (htmlString) => {
    const result = extractLinkWithText(htmlString, 'view example search');
    const part = result.split('/').pop();
    const decodedString = Buffer.from(part, 'base64').toString('utf8');
    const regex = /\u0001(.*?)\u0003/;
    const match = decodedString.match(regex);
    // Extract the matched text (if any)
    return match ? match[1] : '';
}

// Helper function to extract the original sender from a forwarded email body
const extractOriginalSender = (body) => {
    // Define a regular expression pattern to extract the original sender's email address
    const regex = /From:.*<(.*@.*)>/i;
    const match = body.match(regex);
    return match ? match[1] : '';
};

const getEmailBody = (payload) => {
    let body = '';
    if (payload.mimeType === 'text/plain' || payload.mimeType === 'text/html') {
        // The payload itself is the body (either plain text or HTML)
        body = Buffer.from(payload.body.data, 'base64').toString();
    } else if (payload.mimeType.startsWith('multipart/')) {
        // The payload contains multiple MIME parts (e.g., a multipart email with both text and HTML parts)
        const parts = payload.parts || [];
        for (const part of parts) {
            if (part.mimeType === 'text/plain' || part.mimeType === 'text/html') {
                // Extract the body from the MIME part
                body = Buffer.from(part.body.data, 'base64').toString();
                break;
            }
        }
    }
    return body;
};

// Cloud Function to handle Pub/Sub notifications
exports.gmailNotificationHandler = async (event, context) => {
    try {
        // Access the secret from Secret Manager
        const [version] = await secretManagerClient.accessSecretVersion({
            name: credentialsSecretName
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
            auth: oauth2Client
        });


        // Access the secret from Secret Manager
        const [webhookVersion] = await secretManagerClient.accessSecretVersion({
            name: webhookSecretName
        });

        const discordWebhookUrl = webhookVersion.payload.data.toString();

        // ... (the rest of your Cloud Function code)
        try {
            const res = await gmail.users.messages.list({
                userId: 'me',
                q: 'is:unread',
                maxResults: 1, // Limit the results to 1 message
                orderBy: 'internalDate', // Order by internal date
            });

            const messages = res.data.messages;
            if (!messages || messages.length === 0) {
                console.log('No unread messages found.');
                return;
            }

            // Get the most recent message (first in the list)
            const messageId = messages[0].id;
            // Iterate through each message ID and get the details of the email

            // Get the details of the email
            const email = await gmail.users.messages.get({
                userId: 'me',
                id: messageId
            });


            // Extract the email details (subject, from, etc.)
            const headers = email.data.payload.headers;
            const subject = getHeaderValueByName(headers, 'subject').replace(/^Fwd:\s*/i, '');

            const payload = email.data.payload;
            const body = getEmailBody(payload);

            // Function to recursively decode and print MIME parts
            const decodeAndPrintParts = (parts) => {
                for (const part of parts) {
                    if (part.mimeType === 'text/plain' || part.mimeType === 'text/html') {
                        const decodedPart = Buffer.from(part.body.data, 'base64').toString('utf8');
                        return decodedPart;
                    }
                }
            };

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


            // Extract the original sender's email address from the email body
            const originalSender = extractOriginalSender(body);

            console.log({originalSender})
            console.log(headers)

            const forwardRuleReturnPath = '<donniewmattingly+caf_=discordnotificationemails185=gmail.com@gmail.com>'

            if (originalSender.includes('going') || getHeaderValueByName(headers, 'Return-Path').includes(forwardRuleReturnPath)) {

                const sanitized = removeElementByClassName(htmlWithMetaTag, 'gmail_attr');
                const randomFileName = `file-${Math.random().toString(36).substr(2, 9)}.html`;
                await saveHtmlStringToCloudStorage('travel-alerts', randomFileName, sanitized);

                // Create embed for Discord
                const embed = {
                    color: 3447003, // Color of the embed (decimal, not hex)
                    title: subject, // Subject of the email as the title of the embed
                    url: `https://storage.googleapis.com/travel-alerts/${randomFileName}`, // Link to the email
                };

                // Send the embed to the Discord webhook
                await axios.post(discordWebhookUrl, {
                    embeds: [embed] // Array of embeds
                });
            }


        } catch (error) {
            console.error(error);
        }
    } catch (error) {
        console.error(error);
    }
};

const pubSubTopic = 'projects/parledger-app/topics/new-going-emails';
// Cloud Function to re-establish Gmail watch
exports.establishGmailWatch = async (req, res) => {
    try {

        // Access the secret from Secret Manager
        const [version] = await secretManagerClient.accessSecretVersion({
            name: credentialsSecretName
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
            auth: oauth2Client
        });
        // Set up Gmail watch
        await gmail.users.watch({
            userId: 'me',
            requestBody: {
                topicName: pubSubTopic,
                labelIds: ['INBOX'],
            },
        });
        console.log('Gmail watch successfully re-established.');
    } catch (error) {
        console.error('Failed to re-establish Gmail watch:', error);
    }
};
