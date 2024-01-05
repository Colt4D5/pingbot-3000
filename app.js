import fetch from 'node-fetch';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import pkg from '@slack/bolt';
const { App } = pkg;
import dotenv from 'dotenv';
dotenv.config();

let totalRows;
let flaggedSites = 0;
const flaggedSalons = [];

// connect to pingy sites spreadsheet
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SPREADSHEET_ID);

// initialize and authorize Pingy to access IM slack space
const app = new App({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  token: process.env.SLACK_BOT_TOKEN,
});

// define Slack channels to send messages to
const channels = {
  sitehealth: process.env.SLACK_CHANNEL_SITEHEALTH_ID,
  pingbotLog: process.env.SLACK_CHANNEL_PINGBOT_LOG_ID
}

// ping them urls, yo
const pingSalonUrls = async () => {
  // authorize access to pingy sites spreadsheet
  await doc.useServiceAccountAuth({
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.split(String.raw`\n`).join('\n'),
  });
  
  // loads document properties and worksheets
  await doc.loadInfo(); 

  // in the order they appear on the sheets UI
  const pingyList = doc.sheetsByIndex[0]; 

  const salons = await pingyList.getRows();
  totalRows = salons.length;
  
  // loop through salons and ping them domains
  for (let salon of salons) {
    if (salon['Domain']) {
      // if (salon._rowNumber > 450) { // to test only a range of rows
        await getResponseCode(salon)
      // }
    }
  }
  
}

async function repingFlaggedSalons() {
  if (flaggedSalons.length > 0) {
    for (let flaggedSalon of flaggedSalons) {
      await getResponseCode(flaggedSalon, true);
    }
  }
}

async function getResponseCode(salon, flagged = false) {
  
  const formattedUrl = salon['Domain'].replace('https://', '').replace('http://', '').replace('www.', '');
  let status;
  try {
    const url = 
      salon['Domain'] === 'host.immarketing.net:2087' ||
      salon['Domain'] === 'host.imaginalmarketing.net:2087' ? 
      `http://${formattedUrl}` :
      `https://${formattedUrl}`;
    const res = await fetch(url, {
      timeout: 20000
    });
    status = res.status;
    if (status && typeof status === 'number') {
      if (status < 200 || status > 299) {
        throw new Error(`https://${formattedUrl} responded with a status code of ${status}`);
      }
    } else {
      throw new Error(`https://${formattedUrl} could not be successfully pinged.`);
    }
  } catch (err) {
    if (err?.message) {
      if (!flagged) {
        flaggedSalons.push( salon );
      }
      if (flagged) {
        // site health production channel //
        sendSlackMessage(channels['sitehealth'], `${salon._rowNumber}: ${err.message}`)

        // test channel //
        // sendSlackMessage(channels['pingbotLog'], `${salon._rowNumber}: ${err.message}`)

        flaggedSites++;
      }
    }
    return;
  }
  if (status < 200 || status > 299) {
    if (!flagged) {
      flaggedSalons.push( salon );
    }
    if (flagged) {
      // site health production channel //
      sendSlackMessage(channels['sitehealth'], `${salon._rowNumber}: ${err.message}`)

      // test channel //
      // sendSlackMessage(channels['pingbotLog'], `${salon._rowNumber}: ${err.message}`);

      flaggedSites++;
    }
  }
}

const sendSlackMessage = async (channel, msg) => {
  try {
    // Call the app.chat.postMessage method using the WebClient
    const result = await app.client.chat.postMessage({
      channel: channel,
      text: msg
    });
  }
  catch (err) {
    console.error(err);
  }
}

async function runPingy() {
  sendSlackMessage(channels['pingbotLog'], 'Scan starting...');

  const start = Date.now();

  await pingSalonUrls();
  
  await repingFlaggedSalons();

  // await testPingy();

  const end = Date.now();
  const executionTime = (end - start) / 1000;
  const minutes = Math.trunc(executionTime / 60);
  const seconds = Math.trunc(executionTime % 60);
  sendSlackMessage(channels['pingbotLog'], `Finished scanning ${totalRows} sites after ${minutes} minutes and ${seconds} seconds with ${flaggedSites} flagged sites`)
}
runPingy();

async function testPingy() {

  // authorize access to pingy sites spreadsheet
  await doc.useServiceAccountAuth({
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.split(String.raw`\n`).join('\n'),
  });
  
  // loads document properties and worksheets
  await doc.loadInfo(); 

  // in the order they appear on the sheets UI
  const pingyList = doc.sheetsByIndex[1]; 

  const salons = await pingyList.getRows();
  totalRows = salons.length;
  
  // loop through salons and ping them domains
  for (let salon of salons) {
    if (salon['Domain']) {
      // if (salon._rowNumber > 450) { // to test only a range of rows
        console.log(salon['Domain'])
      // }
    }
  }
}