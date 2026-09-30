import fs from 'fs';
import { getDb } from '../src/server/db';

async function exportSql() {
  const db = getDb();
  let sql = '-- ========================================================\n';
  sql += '-- LagiLagiPadel Database Dump for Hosting (MySQL / MariaDB)\n';
  sql += '-- Database: u372224362_llp\n';
  sql += '-- User: u372224362_llp_root\n';
  sql += '-- Generated: ' + new Date().toISOString() + '\n';
  sql += '-- ========================================================\n\n';
  sql += 'SET NAMES utf8mb4;\n';
  sql += 'SET FOREIGN_KEY_CHECKS = 0;\n\n';

  // Table structures
  sql += '-- Table structure for table `tournaments`\n';
  sql += 'DROP TABLE IF EXISTS `tournaments`;\n';
  sql += 'CREATE TABLE `tournaments` (\n';
  sql += '  `id` VARCHAR(191) NOT NULL PRIMARY KEY,\n';
  sql += '  `name` VARCHAR(255) NOT NULL,\n';
  sql += '  `status` VARCHAR(64) NOT NULL,\n';
  sql += '  `category` VARCHAR(255) DEFAULT NULL,\n';
  sql += '  `date` VARCHAR(64) DEFAULT NULL,\n';
  sql += '  `location` VARCHAR(255) DEFAULT NULL,\n';
  sql += '  `total_prize` VARCHAR(255) DEFAULT NULL,\n';
  sql += '  `data` LONGTEXT NOT NULL,\n';
  sql += '  `updated_at` VARCHAR(64) NOT NULL\n';
  sql += ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n';

  sql += '-- Table structure for table `members`\n';
  sql += 'DROP TABLE IF EXISTS `members`;\n';
  sql += 'CREATE TABLE `members` (\n';
  sql += '  `id` VARCHAR(191) NOT NULL PRIMARY KEY,\n';
  sql += '  `name` VARCHAR(255) NOT NULL,\n';
  sql += '  `nickname` VARCHAR(255) DEFAULT NULL,\n';
  sql += '  `photo_url` TEXT DEFAULT NULL,\n';
  sql += '  `phone` VARCHAR(64) DEFAULT NULL,\n';
  sql += '  `email` VARCHAR(191) DEFAULT NULL,\n';
  sql += '  `club` VARCHAR(255) DEFAULT NULL,\n';
  sql += '  `city` VARCHAR(255) DEFAULT NULL,\n';
  sql += '  `rating` VARCHAR(64) DEFAULT NULL,\n';
  sql += '  `gender` VARCHAR(64) DEFAULT NULL,\n';
  sql += '  `membership_tier` VARCHAR(64) DEFAULT NULL,\n';
  sql += '  `joined_date` VARCHAR(64) DEFAULT NULL,\n';
  sql += '  `status` VARCHAR(64) DEFAULT NULL,\n';
  sql += '  `is_group_qualified` INT DEFAULT 0,\n';
  sql += '  `qualified_tournament` VARCHAR(255) DEFAULT NULL,\n';
  sql += '  `qualified_pool` VARCHAR(64) DEFAULT NULL,\n';
  sql += '  `qualified_phase` VARCHAR(64) DEFAULT NULL,\n';
  sql += '  `achievements` TEXT DEFAULT NULL,\n';
  sql += '  `updated_at` VARCHAR(64) NOT NULL\n';
  sql += ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n';

  sql += '-- Table structure for table `tournament_groups`\n';
  sql += 'DROP TABLE IF EXISTS `tournament_groups`;\n';
  sql += 'CREATE TABLE `tournament_groups` (\n';
  sql += '  `tournament_id` VARCHAR(191) NOT NULL PRIMARY KEY,\n';
  sql += '  `pools_json` LONGTEXT NOT NULL,\n';
  sql += '  `updated_at` VARCHAR(64) NOT NULL\n';
  sql += ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n';

  sql += '-- Table structure for table `brackets`\n';
  sql += 'DROP TABLE IF EXISTS `brackets`;\n';
  sql += 'CREATE TABLE `brackets` (\n';
  sql += '  `tournament_id` VARCHAR(191) NOT NULL PRIMARY KEY,\n';
  sql += '  `bracket_json` LONGTEXT NOT NULL,\n';
  sql += '  `updated_at` VARCHAR(64) NOT NULL\n';
  sql += ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n';

  sql += '-- Table structure for table `referee_state`\n';
  sql += 'DROP TABLE IF EXISTS `referee_state`;\n';
  sql += 'CREATE TABLE `referee_state` (\n';
  sql += '  `id` VARCHAR(191) NOT NULL PRIMARY KEY,\n';
  sql += '  `state_json` LONGTEXT NOT NULL,\n';
  sql += '  `updated_at` VARCHAR(64) NOT NULL\n';
  sql += ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n';

  sql += '-- Table structure for table `system_meta`\n';
  sql += 'DROP TABLE IF EXISTS `system_meta`;\n';
  sql += 'CREATE TABLE `system_meta` (\n';
  sql += '  `key` VARCHAR(191) NOT NULL PRIMARY KEY,\n';
  sql += '  `value` LONGTEXT DEFAULT NULL,\n';
  sql += '  `updated_at` VARCHAR(64) NOT NULL\n';
  sql += ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n';

  function escapeVal(str: any): string {
    if (str === null || str === undefined) return 'NULL';
    return "'" + String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r') + "'";
  }

  // Dump data
  const tRows = await db.execute('SELECT * FROM tournaments');
  if (tRows.rows.length > 0) {
    sql += '-- Dumping data for table `tournaments`\n';
    for (const r of tRows.rows) {
      sql += `INSERT INTO \`tournaments\` (\`id\`, \`name\`, \`status\`, \`category\`, \`date\`, \`location\`, \`total_prize\`, \`data\`, \`updated_at\`) VALUES (${escapeVal(r.id)}, ${escapeVal(r.name)}, ${escapeVal(r.status)}, ${escapeVal(r.category)}, ${escapeVal(r.date)}, ${escapeVal(r.location)}, ${escapeVal(r.total_prize)}, ${escapeVal(r.data)}, ${escapeVal(r.updated_at)});\n`;
    }
    sql += '\n';
  }

  const mRows = await db.execute('SELECT * FROM members');
  if (mRows.rows.length > 0) {
    sql += '-- Dumping data for table `members`\n';
    for (const r of mRows.rows) {
      sql += `INSERT INTO \`members\` (\`id\`, \`name\`, \`nickname\`, \`photo_url\`, \`phone\`, \`email\`, \`club\`, \`city\`, \`rating\`, \`gender\`, \`membership_tier\`, \`joined_date\`, \`status\`, \`is_group_qualified\`, \`qualified_tournament\`, \`qualified_pool\`, \`qualified_phase\`, \`achievements\`, \`updated_at\`) VALUES (${escapeVal(r.id)}, ${escapeVal(r.name)}, ${escapeVal(r.nickname)}, ${escapeVal(r.photo_url)}, ${escapeVal(r.phone)}, ${escapeVal(r.email)}, ${escapeVal(r.club)}, ${escapeVal(r.city)}, ${escapeVal(r.rating)}, ${escapeVal(r.gender)}, ${escapeVal(r.membership_tier)}, ${escapeVal(r.joined_date)}, ${escapeVal(r.status)}, ${r.is_group_qualified || 0}, ${escapeVal(r.qualified_tournament)}, ${escapeVal(r.qualified_pool)}, ${escapeVal(r.qualified_phase)}, ${escapeVal(r.achievements)}, ${escapeVal(r.updated_at)});\n`;
    }
    sql += '\n';
  }

  const gRows = await db.execute('SELECT * FROM tournament_groups');
  if (gRows.rows.length > 0) {
    sql += '-- Dumping data for table `tournament_groups`\n';
    for (const r of gRows.rows) {
      sql += `INSERT INTO \`tournament_groups\` (\`tournament_id\`, \`pools_json\`, \`updated_at\`) VALUES (${escapeVal(r.tournament_id)}, ${escapeVal(r.pools_json)}, ${escapeVal(r.updated_at)});\n`;
    }
    sql += '\n';
  }

  const bRows = await db.execute('SELECT * FROM brackets');
  if (bRows.rows.length > 0) {
    sql += '-- Dumping data for table `brackets`\n';
    for (const r of bRows.rows) {
      sql += `INSERT INTO \`brackets\` (\`tournament_id\`, \`bracket_json\`, \`updated_at\`) VALUES (${escapeVal(r.tournament_id)}, ${escapeVal(r.bracket_json)}, ${escapeVal(r.updated_at)});\n`;
    }
    sql += '\n';
  }

  const rRows = await db.execute('SELECT * FROM referee_state');
  if (rRows.rows.length > 0) {
    sql += '-- Dumping data for table `referee_state`\n';
    for (const r of rRows.rows) {
      sql += `INSERT INTO \`referee_state\` (\`id\`, \`state_json\`, \`updated_at\`) VALUES (${escapeVal(r.id)}, ${escapeVal(r.state_json)}, ${escapeVal(r.updated_at)});\n`;
    }
    sql += '\n';
  }

  const sysRows = await db.execute('SELECT `key`, `value`, `updated_at` FROM system_meta');
  if (sysRows.rows.length > 0) {
    sql += '-- Dumping data for table `system_meta`\n';
    for (const r of sysRows.rows) {
      sql += `INSERT INTO \`system_meta\` (\`key\`, \`value\`, \`updated_at\`) VALUES (${escapeVal(r.key)}, ${escapeVal(r.value)}, ${escapeVal(r.updated_at)});\n`;
    }
    sql += '\n';
  }

  sql += 'SET FOREIGN_KEY_CHECKS = 1;\n';
  fs.writeFileSync('database_hosting.sql', sql, 'utf-8');
  console.log('✅ File database_hosting.sql berhasil dibuat!');
}

exportSql();
