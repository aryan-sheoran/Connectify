const cron = require('node-cron');
const pool = require('../config/db');

/**
 * Deletes all messages older than 24 hours.
 * Extracted so it can be called on startup AND on schedule.
 */
const deleteOldMessages = async () => {
  try {
    console.log('🧹 Running cleanup: Deleting messages older than 24 hours...');
    const result = await pool.query(
      "DELETE FROM messages WHERE sent_at < NOW() - INTERVAL '24 hours'"
    );

    if (result.rowCount > 0) {
      console.log(`✅ Deleted ${result.rowCount} old message(s).`);
    } else {
      console.log('✅ No old messages to delete.');
    }
  } catch (err) {
    console.error('❌ Failed to clean old messages:', err);
  }
};

// Schedule tasks to be run on the server
const initCronJobs = () => {
  console.log('⏰ Initialising cron jobs...');

  // Run immediately on server start so stale messages are removed right away
  deleteOldMessages();

  // Then run every hour (at minute 0) to keep the table clean continuously
  cron.schedule('0 * * * *', deleteOldMessages);
};

module.exports = initCronJobs;
