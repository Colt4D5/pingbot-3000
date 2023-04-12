import fetch from 'node-fetch';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import pkg from '@slack/bolt';
const { App } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const doc = new GoogleSpreadsheet(process.env.GOOGLE_SPREADSHEET_ID);

const app = new App({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  token: process.env.SLACK_BOT_TOKEN,
});

const channels = {
  sitehealth: process.env.SLACK_CHANNEL_SITEHEALTH_ID,
  pingbotLog: process.env.SLACK_CHANNEL_PINGBOT_LOG_ID
}

const pingSalonUrls = async () => {
  await doc.useServiceAccountAuth({
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.split(String.raw`\n`).join('\n'),
  });
  
  await doc.loadInfo(); // loads document properties and worksheets


  const pingyList = doc.sheetsByIndex[3]; // in the order they appear on the sheets UI

  const salons = await pingyList.getRows();

  const start = Date.now();

  for (const salon of salons) {
      await getResponseCode(salon['Domain'])
  }

  const end = Date.now();
  const executionTime = (end - start) / 1000;
  console.log(`Execution time: ${executionTime} seconds`);

  async function getResponseCode(url) {
    const formattedUrl = url.replace('https://').replace('https//').replace('www.', '');
    const res = await fetch(`https://${formattedUrl}`);
    console.log(`${res.status}`)
    if (res.status !== 200) {
      sendSlackMessage(channels['sitehealth'], `${url} responded with a status code of ${res.status}`)
    }
  }

}
pingSalonUrls();

const sendSlackMessage = async (channel, msg) => {
  try {
    // Call the app.chat.postMessage method using the WebClient
    const result = await app.client.chat.postMessage({
      channel: channel,
      text: msg
    });
  }
  catch (error) {
    console.error(error);
  }
}