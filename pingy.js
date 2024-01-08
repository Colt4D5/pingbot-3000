// Pingy that fetches from a remote json file
// ** args:
// **** --list={https://json/file/url.json}
// **** -t [test mode -> sends to pingbot-log instead of health]
import fetch from 'node-fetch';
import pkg from '@slack/bolt';
const { App } = pkg;
import dotenv from 'dotenv';
dotenv.config();

let list = 'https://potatohead.imaginalmarketing.net/urls.json';
let isTest = false

process.argv.forEach(arg => {
  if (arg.slice(0, 7).toLowerCase() === '--list=') {
    list = arg.split('=')[1]
  } else if (arg === '-t') {
    isTest = true
  }
})

async function getUrls(url) {
  const response = await fetch(url);
  const data = await response.json();
  return data
}
const sites = await getUrls(list);

let totalRows;
let flaggedSites = 0;
const flaggedSalons = [];

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
  totalRows = sites.urls.length;
  
  // loop through salons and ping them domains
  // for (let salon of sites.urls) {
  //   console.log(salon);
  //   await getResponseCode(salon)
  // }
  const response = await Promise.all(sites.urls.map(url => getResponseCode(url)))
  
}

async function repingFlaggedSalons() {
  if (flaggedSalons.length > 0) {
    for (let flaggedSalon of flaggedSalons) {
      await getResponseCode(flaggedSalon, true);
    }
  }
}

async function getResponseCode(salon, flagged = false) {
  
  const formattedUrl = salon.replace('https://', '').replace('http://', '').replace('www.', '');
  let status;
  try {
    const url = 
      salon === 'host.immarketing.net:2087' ||
      salon === 'host.imaginalmarketing.net:2087' ? 
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
        if (!isTest) {
          // site health production channel //
          sendSlackMessage(channels['sitehealth'], err.message)
        } else {
          // test channel //
          sendSlackMessage(channels['pingbotLog'], err.messag)
        }


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
      if (!isTest) {
        // site health production channel //
        sendSlackMessage(channels['sitehealth'], err.message)
      } else {
        // test channel //
        sendSlackMessage(channels['pingbotLog'], err.message);
      }


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

  const end = Date.now();
  const executionTime = (end - start) / 1000;
  const minutes = Math.trunc(executionTime / 60);
  const seconds = Math.trunc(executionTime % 60);
  sendSlackMessage(channels['pingbotLog'], `Finished scanning ${totalRows} sites after ${minutes} minutes and ${seconds} seconds with ${flaggedSites} flagged sites`)
}
runPingy();
