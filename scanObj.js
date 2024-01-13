const today = new Date();
const year = today.getFullYear();
let month = today.getMonth() + 1;
let day = today.getDate();
if (month < 10) month = `0${month}`
if (day < 10) day = `0${day}`

const formattedDate = `${year}-${month}-${day}`

export const scanObj = (pings) => {
  return { date: formattedDate, pings}
}