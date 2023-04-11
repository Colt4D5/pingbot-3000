const { GoogleSpreadsheet } = require('google-spreadsheet');
const creds = require('./config/graphic-tide-340702-00aaae7a357a.json');
const doc = new GoogleSpreadsheet('1alLfPeuZUmVsNUA6nfrOwaKNzd0GHM1UL99dS4c51v8');

const doStuff = async () => {
  await doc.useServiceAccountAuth(creds);
  
  await doc.loadInfo(); // loads document properties and worksheets


  const firstSheet = doc.sheetsByIndex[3]; // in the order they appear on the sheets UI

  console.log(firstSheet.title);
}
doStuff();