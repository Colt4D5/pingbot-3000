// Pingy that fetches from a remote json file
// ** args:
// **** http:// || https:// will query list
// **** -t [test mode -> sends to pingbot-log instead of health]
// **** -b [force break mode -> changes first domain to a broken url to test error message]
import fetch from 'node-fetch';
import pkg from '@slack/bolt';
const { App } = pkg;
import dotenv from 'dotenv';
dotenv.config();
import fs from 'node:fs';

let isTest = false
let willBreak = false

let compiledListArr = []

process.argv.forEach(arg => {
  if (arg.includes('http://') || arg.includes('https://')) {
    compiledListArr.push(arg)
  } else if (arg === '-t') {
    isTest = true
  } else if (arg === '-b') {
    willBreak = true
  }
})

if (compiledListArr.length === 0) {
  compiledListArr = ['http://67.227.167.26/filtered_accounts.json','http://67.227.166.13/filtered_accounts.json']
}

async function getUrls(listUrl) {
  const response = await fetch(listUrl);
  if (response.ok) {
    const data = await response.json();
    return data
  }
}

let allUrls = []

for await (const list of compiledListArr) {
  const urls = await getUrls(list);
  if (urls?.active?.length > 0) {
    allUrls = [...allUrls, ...urls?.active]
  }
}

// const sites = await getUrls(compiledListArr);

if (!isTest && allUrls.length > 0) { // only write to the file system if remote urls were retrieved
  const localFile = [...allUrls]
  try {
    fs.writeFileSync('./local_accounts.json', JSON.stringify(localFile, null, 2));
  } catch (err) {
    console.error(err);
  }
}


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
const pingSalonUrls = async (arr) => {
  totalRows = arr.length

  if (isTest) {
    arr = arr.slice(0, 15);
    totalRows = arr.length;
  }
  if (willBreak) {
    arr[0].domain = 'fakeurlfortesting.edu'
  }

  const response = await Promise.all(arr.map(acct => getResponseCode(acct.domain)))
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
  let hasCriticalError = false;
  try {
    const url = 
      salon === 'host.immarketing.net:2087' ||
      salon === 'host.imaginalmarketing.net:2087' ? 
      `http://${formattedUrl}` :
      `https://${formattedUrl}`;
    const res = await fetch(url, {
      timeout: 20000
    });

    // scan response text for critical error in message
    const ResText = await res.text();
    if (ResText.includes('There has been a critical error on this website')) {
      hasCriticalError = true;
      throw new Error(`*Attention*: There has a critical error on https://${formattedUrl}.`);
    }
    
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
      } else {
        if (!isTest) {
          // site health production channel //
          sendSlackMessage(channels['sitehealth'], err.message)
        } else {
          // test channel //
          sendSlackMessage(channels['pingbotLog'], err.message)
        }


        flaggedSites++;
      }
    } else {
      if (!isTest) {
        // site health production channel //
        sendSlackMessage(channels['sitehealth'], `Something went wrong while requesting https://${formattedUrl}`, hasCriticalError)
      } else {
        // test channel //
        sendSlackMessage(channels['pingbotLog'], `Something went wrong while requesting https://${formattedUrl}`, hasCriticalError)
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
        sendSlackMessage(channels['sitehealth'], `https://${salon} responded with a status code of ${status}`, hasCriticalError)
      } else {
        // test channel //
        sendSlackMessage(channels['pingbotLog'], `https://${salon} responded with a status code of ${status}`, hasCriticalError);
      }


      flaggedSites++;
    }
  } else {
    // all is well, no need for alarm
  }
}

const sendSlackMessage = async (channel, msg, useMarkdown = false) => {
  try {
    // Call the app.chat.postMessage method using the WebClient
    const result = await app.client.chat.postMessage({
      channel: channel,
      text: msg,
      mrkdwn: useMarkdown
    });
  }
  catch (err) {
    console.error(err);
  }
}

async function runPingy() {
  sendSlackMessage(channels['pingbotLog'], 'Scan starting...');

  const start = Date.now();

  const arr = allUrls.length > 0 ? allUrls : localFile

  await pingSalonUrls(arr);
  
  await repingFlaggedSalons();

  const end = Date.now();
  const executionTime = (end - start) / 1000;
  const minutes = Math.trunc(executionTime / 60);
  const seconds = Math.trunc(executionTime % 60);
  sendSlackMessage(channels['pingbotLog'], `Finished scanning ${totalRows} sites after ${minutes} minutes and ${seconds} seconds with ${flaggedSites} flagged sites`)
}
runPingy();
