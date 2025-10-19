import app from 'express';
import dotenv from "dotenv";

// configure env
dotenv.config();

const PORT = process.env.PORT || 6060;

app.listen(PORT, () => {
    console.log(`Server running on ${process.env.DEV_MODE} mode on ${PORT}`.bgCyan.white);
});