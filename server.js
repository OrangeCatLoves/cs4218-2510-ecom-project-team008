import app from './app';
import dotenv from "dotenv";


// configure env
dotenv.config();

const isIntegration = process.env.TEST_TYPE === 'integration'

// uses any available port when running test because supertest runs multiple test suits in parallel
const PORT = isIntegration ? 0 : process.env.PORT || 6060;

app.listen(PORT, () => {
    console.log(`Server running on ${process.env.DEV_MODE} mode on ${PORT}`.bgCyan.white);
});