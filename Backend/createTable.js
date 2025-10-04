const client=require("./database");

const createTables= async()=>{
    try{
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(100) UNIQUE NOT NULL,
            passwordHash VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
            `);

            await client.query(`
                CREATE TABLE IF NOT EXISTS notes(
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) on DELETE CASCADE,
                original_text TEXT,
                processed_text TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
                `);

            await client.query(`
                CREATE TABLE IF NOT EXISTS flashcards(
                id SERIAL PRIMARY KEY,
                note_id INTEGER REFERENCES notes(id) ON DELETE CASCADE,
                question TEXT,
                answer TEXT,
                next_review_date DATE,
                ease_factor REAL DEFAULT 2.5,
                repetition_count INTEGER DEFAULT 0);
                `);

         console.log("tables created sussessfully");
            
    }catch(err){
        console.error(err);
    }finally{
        client.end();
    }
};
createTables();
