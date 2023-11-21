const { google } = require("googleapis");

const {
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI,
  REFRESH_TOKEN,
} = require("./credentials");

const oAuth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

const repliedUsers = new Set();

async function checkEmailsAndSendReplies() {
  try {
    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

    // Get the list of unread messages.
    const res = await gmail.users.messages.list({
      userId: "me",
      q: "is:unread",
    });
    const messages = res.data.messages;

    if (messages && messages.length > 0) {
      // Fetch the complete message details.
      for (const message of messages) {
        const email = await gmail.users.messages.get({
          userId: "me",
          id: message.id,
        });

        const from = email.data.payload.headers.find(
          (header) => header.name === "From"
        );
        const toHeader = email.data.payload.headers.find(
          (header) => header.name === "To"
        );
        const Subject = email.data.payload.headers.find(
          (header) => header.name === "Subject"
        );
        //who sends email extracted
        const From = from.value;
        //who gets email extracted
        const toEmail = toHeader.value;
        //subject of unread email
        const subject = Subject.value;
        console.log("email come From", From);
        console.log("to Email", toEmail);
        //check if the user already been replied to
        if (repliedUsers.has(From)) {
          console.log("Already replied to : ", From);
          continue;
        }
        // send replies to Emails that have no prior replies
        // Check if the email has any replies.
        const thread = await gmail.users.threads.get({
          userId: "me",
          id: message.threadId,
        });

        //isolated the email into threads
        const replies = thread.data.messages.slice(1);

        if (replies.length === 0) {
          // Reply to the email.
          await gmail.users.messages.send({
            userId: "me",
            requestBody: {
              raw: await createReplyRaw(toEmail, From, subject),
            },
          });

          // Add a label to the email.
          const labelName = "onVacation";
          await gmail.users.messages.modify({
            userId: "me",
            id: message.id,
            requestBody: {
              addLabelIds: [await createLabelIfNeeded(labelName)],
            },
          });

          console.log("Sent reply to email:", From);
          //Add the user to replied users set
          repliedUsers.add(From);
        }
      }
    }
  } catch (error) {
    console.error("Error occurred:", error);
  }
}

async function createReplyRaw(from, to, subject) {
  const emailContent = `From: ${from}\nTo: ${to}\nSubject: ${subject}\n\nThank you for your message. i am  unavailable right now, but will respond as soon as possible...`;
  const base64EncodedEmail = Buffer.from(emailContent)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return base64EncodedEmail;
}

async function createLabelIfNeeded(labelName) {
  const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
  // Check if the label already exists.
  const res = await gmail.users.labels.list({ userId: "me" });
  const labels = res.data.labels;

  const existingLabel = labels.find((label) => label.name === labelName);
  if (existingLabel) {
    return existingLabel.id;
  }

  // Create the label if it doesn't exist.
  const newLabel = await gmail.users.labels.create({
    userId: "me",
    requestBody: {
      name: labelName,
      labelListVisibility: "labelShow",
      messageListVisibility: "show",
    },
  });

  return newLabel.data.id;
}

function getRandomInterval(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}


setInterval(checkEmailsAndSendReplies, getRandomInterval(45, 120) * 1000);
