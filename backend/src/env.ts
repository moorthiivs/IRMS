import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from backend/.env or root
dotenv.config({ path: path.join(__dirname, '..', '.env') });
