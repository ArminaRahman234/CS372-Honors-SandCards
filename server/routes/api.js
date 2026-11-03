import express from 'express';

const router = express.Router();

router.get('/test', (req, res) => {
    res.json({ message: 'Router is working!' });
});

export default router;