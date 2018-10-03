//Import Depedencies
const express = require('express');
const pc = require('../external-services/pathway-commons');

const router = express.Router();


router.get('/search', function (req, res) {
  pc.search(req.query).then(r => res.json(r));
});


module.exports = router;