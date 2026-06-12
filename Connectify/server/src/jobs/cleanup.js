const cron = require('node-cron');
const pool = require('../config/db');

// Schedule tasks to be run on the server
const initCronJobs = () => {
  console.log('⏰ Initialising cron jobs...');

  // Run this job every hour (at minute 0)
  cron.schedule('0 * * * *', async () => {
    try {
      console.log('🧹 Running scheduled cleanup: Deleting messages older than 24 hours...');
      const result = await pool.query(
        "DELETE FROM messages WHERE sent_at < NOW() - INTERVAL '24 hours'"
      );
      
      if (result.rowCount > 0) {
        console.log(`✅ Successfully deleted ${result.rowCount} old messages.`);
      } else {
        console.log('✅ No old messages to delete.');
      }
    } catch (err) {
      console.error('❌ Failed to clean old messages:', err);
    }
  });
};

module.exports = initCronJobs;
