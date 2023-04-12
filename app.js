import fetch from 'node-fetch';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import dotenv from 'dotenv';
dotenv.config();
// import './config/graphic-tide-340702-00aaae7a357a.json';
const doc = new GoogleSpreadsheet('1alLfPeuZUmVsNUA6nfrOwaKNzd0GHM1UL99dS4c51v8');

// console.log(process.env.GOOGLE_PRIVATE_KEY);


const doStuff = async () => {
  // await doc.useServiceAccountAuth(creds);
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
  }
  
  // console.log(salons[1].Domain)
}
doStuff();