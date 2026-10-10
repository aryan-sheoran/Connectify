// routes/searchRoutes.js
const express = require('express');
const router  = express.Router();

const { searchRooms }       = require('../controllers/searchController');
const { validateRoomSearch } = require('../middleware/validationMiddleware');

// GET /search/rooms?name=tech&id=ROOM001
// Public — searches public rooms by name and/or ID
router.get('/rooms', validateRoomSearch, searchRooms);

module.exports = router;
