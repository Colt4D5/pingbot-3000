import { promises as fs } from 'fs';
import sqlite3 from 'sqlite3'
const connection = sqlite3.verbose();

export const logPing = async (obj) => {
  await fs.readFile(process.env.DB_PATH).catch(() =>
    fs.writeFile(process.env.DB_PATH, '')
  );

  // connect to the db
  const db = new connection.Database('./test.sqlite', connection.OPEN_READWRITE, err => {
    if (err) return console.error(err.message);
  });

  // make sure the tables exist in the db
  let scanSql = `CREATE TABLE IF NOT EXISTS Scans(
                    scan_id INTEGER, 
                    date DATE, 
                    pings INTEGER,
                    PRIMARY KEY (scan_id)
                  )`;
  let pingSql = `CREATE TABLE IF NOT EXISTS Pings(
                    id INTEGER,
                    scan_id INTEGER,
                    domain VARCHAR(255) NOT NULL, 
                    status VARCHAR(20),
                    date DATE,
                    PRIMARY KEY (id)
                    CONSTRAINT FK_Scans FOREIGN KEY (scan_id)
                    REFERENCES Scans(scan_id)
                  )`;
  let domainSql = `CREATE TABLE IF NOT EXISTS Domains(
                    id INTEGER,
                    domain VARCHAR(255) NOT NULL, 
                    server VARCHAR(255),
                    pings INTEGER,
                    PRIMARY KEY (id)
                    UNIQUE (domain)
                    CONSTRAINT FK_Scans FOREIGN KEY (domain)
                    REFERENCES Pings(domain)
                  )`;

  const masterObj = obj

  const scan = {
    date: masterObj.date,
    pings: masterObj.pings.length
  }

  const pings = []
  masterObj.pings.forEach(domain => {
    pings.push({
      domain: domain.domain,
      status: domain.status,
      date: masterObj.date
    })
  })

  const domains = []
  masterObj.pings.forEach(domain => {
    domains.push({
      domain: domain.domain,
      server: domain.ip_address || '67.227.167.26',
    })
  })


  db.serialize(() => {
    const tables = [scanSql, pingSql, domainSql]
    
    tables.forEach(sql => {
      db.run(sql);
    })

    db.run("INSERT INTO Scans (date, pings) VALUES (?,?)", [scan.date, scan.pings], function(err) {
      if (err) {
        return console.log(err.message);
      }

      pings.forEach(ping => {
        db.run("INSERT INTO Pings (scan_id, domain, status, date) VALUES (?,?,?,?)", [this.lastID, ping.domain, ping.status, ping.date], function(err) {
          if (err) {
            return console.log(err.message);
          }
        })
      })

      
      domains.forEach(domain => {
        db.run("INSERT INTO Domains (domain, server, pings) VALUES (?,?,?)", [domain.domain, domain.server, 1], function(err) {
          if (err) {
            if (err.message === 'SQLITE_CONSTRAINT: UNIQUE constraint failed: Domains.domain') {
              db.run("UPDATE Domains SET pings = pings + 1 WHERE Domains.domain = ?", [domain.domain])
            }
          }
        })
      })

    });

  });
  
}