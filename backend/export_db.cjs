const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

function escapeSqlVal(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (val instanceof Date) {
    const d = new Date(val);
    const pad = (n) => String(n).padStart(2, '0');
    return `'${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}'`;
  }
  if (Buffer.isBuffer(val)) {
    return `X'${val.toString('hex')}'`;
  }
  const s = String(val)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\x00/g, '\\0');
  return `'${s}'`;
}

async function main() {
  let conn;
  try {
    console.log('Connecting to Railway MySQL database...');
    conn = await mysql.createConnection({
      host: 'switchyard.proxy.rlwy.net',
      port: 52365,
      user: 'root',
      password: 'DAILGcMsVsxmMGsopBUMFUQtDwldOjHB',
      database: 'railway',
      connectTimeout: 20000
    });

    console.log('Connected! Fetching table list...');
    const [tableRows] = await conn.query('SHOW FULL TABLES WHERE Table_type = "BASE TABLE"');
    const tableNames = tableRows.map(r => Object.values(r)[0]);

    let sql = '';
    sql += '-- =====================================================================\n';
    sql += '-- Complete Database SQL Dump\n';
    sql += '-- Database: `railway` (Fund Portal Production)\n';
    sql += '-- Export Date: ' + new Date().toISOString() + '\n';
    sql += '-- Total Tables: ' + tableNames.length + '\n';
    sql += '-- =====================================================================\n\n';
    sql += '/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;\n';
    sql += '/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;\n';
    sql += '/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;\n';
    sql += '/*!50503 SET NAMES utf8mb4 */;\n';
    sql += '/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;\n';
    sql += '/*!40103 SET TIME_ZONE="+00:00" */;\n';
    sql += '/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;\n';
    sql += '/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;\n';
    sql += '/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE="NO_AUTO_VALUE_ON_ZERO" */;\n';
    sql += '/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;\n\n';

    let totalRowsCount = 0;

    for (const table of tableNames) {
      console.log(`Exporting table [${table}]...`);
      const [[createRow]] = await conn.query(`SHOW CREATE TABLE \`${table}\``);
      const createTableSql = createRow['Create Table'] || Object.values(createRow)[1];

      sql += '--\n';
      sql += `-- Table structure for table \`${table}\`\n`;
      sql += '--\n\n';
      sql += `DROP TABLE IF EXISTS \`${table}\`;\n`;
      sql += '/*!40101 SET @saved_cs_client     = @@character_set_client */;\n';
      sql += '/*!50503 SET character_set_client = utf8mb4 */;\n';
      sql += createTableSql + ';\n';
      sql += '/*!40101 SET character_set_client = @saved_cs_client */;\n\n';

      const [rows] = await conn.query(`SELECT * FROM \`${table}\``);
      totalRowsCount += rows.length;

      if (rows.length > 0) {
        sql += '--\n';
        sql += `-- Dumping data for table \`${table}\` (${rows.length} rows)\n`;
        sql += '--\n\n';
        sql += `LOCK TABLES \`${table}\` WRITE;\n`;
        sql += '/*!40000 ALTER TABLE `' + table + '` DISABLE KEYS */;\n';

        const cols = Object.keys(rows[0]).map(c => `\`${c}\``).join(', ');
        const chunkSize = 50;
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize);
          const valuesSql = chunk.map(r => {
            const vals = Object.values(r).map(escapeSqlVal);
            return `(${vals.join(', ')})`;
          }).join(',\n  ');
          sql += `INSERT INTO \`${table}\` (${cols}) VALUES\n  ${valuesSql};\n`;
        }

        sql += '/*!40000 ALTER TABLE `' + table + '` ENABLE KEYS */;\n';
        sql += 'UNLOCK TABLES;\n\n';
      }
    }

    sql += '/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;\n';
    sql += '/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;\n';
    sql += '/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;\n';
    sql += '/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;\n';
    sql += '/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;\n';
    sql += '/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;\n';
    sql += '/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;\n';
    sql += '/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;\n\n';
    sql += `-- Dump completed on ${new Date().toISOString()}\n`;

    const outputPath = path.resolve('..', 'database_backup.sql');
    fs.writeFileSync(outputPath, sql, 'utf8');

    const stats = fs.statSync(outputPath);
    console.log(`\n======================================================`);
    console.log(`✓ EXPORT COMPLETE!`);
    console.log(`✓ Total Tables: ${tableNames.length}`);
    console.log(`✓ Total Rows:   ${totalRowsCount}`);
    console.log(`✓ Output File:  ${outputPath}`);
    console.log(`✓ File Size:    ${(stats.size / 1024).toFixed(2)} KB (${stats.size.toLocaleString()} bytes)`);
    console.log(`======================================================\n`);
  } catch (err) {
    console.error('Fatal error during export:', err);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

main();
