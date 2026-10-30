/* Account-scoped AI threads. Revision checks prevent an old tab overwriting a newer session. */
const { getMySQLPool } = require('./dbService');
let ready;
async function database() {
  const pool = getMySQLPool();
  if (!pool) throw new Error('Conversation database is unavailable');
  if (!ready) ready = pool.query(`CREATE TABLE IF NOT EXISTS ai_conversation_threads (
    owner_id VARCHAR(128) NOT NULL,
    id VARCHAR(96) NOT NULL,
    revision INT UNSIGNED NOT NULL DEFAULT 1,
    payload LONGTEXT NOT NULL,
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (owner_id, id)
  ) CHARACTER SET utf8mb4`).catch(error=>{ready=null;throw error;});
  await ready; return pool;
}
function decode(row) { return {...JSON.parse(row.payload), revision:row.revision}; }
module.exports = {
  async list(owner) {
    const pool=await database();
    const [rows]=await pool.query('SELECT revision,payload FROM ai_conversation_threads WHERE owner_id=? ORDER BY updated_at DESC',[String(owner)]);
    return rows.map(decode);
  },
  async put(owner, thread, expected) {
    const pool=await database();
    const payload=JSON.stringify(thread);
    if (!expected) {
      try { await pool.query('INSERT INTO ai_conversation_threads(owner_id,id,revision,payload) VALUES(?,?,1,?)',[String(owner),thread.id,payload]);return {...thread,revision:1}; }
      catch(error) { if(error.code!=='ER_DUP_ENTRY')throw error; }
    } else {
      const [result]=await pool.query('UPDATE ai_conversation_threads SET revision=revision+1,payload=?,updated_at=CURRENT_TIMESTAMP(3) WHERE owner_id=? AND id=? AND revision=?',[payload,String(owner),thread.id,expected]);
      if(result.affectedRows)return {...thread,revision:expected+1};
    }
    const error=new Error('This conversation was updated in another tab. Refresh before saving.');error.status=409;throw error;
  },
  async remove(owner,id) {
    const pool=await database();await pool.query('DELETE FROM ai_conversation_threads WHERE owner_id=? AND id=?',[String(owner),id]);
  },
  async removeChat(owner,id) {
    const pool=await database();
    const [rows]=await pool.query('SELECT revision,payload FROM ai_conversation_threads WHERE owner_id=? AND id=?',[String(owner),id]);
    if(!rows.length)return null;
    const thread=decode(rows[0]);
    return this.put(owner,{...thread,deleted:true,messages:[],updatedAt:new Date().toISOString()},thread.revision);
  },
  async removeCourt(owner,id,sessionId) {
    const pool=await database();
    const [rows]=await pool.query('SELECT revision,payload FROM ai_conversation_threads WHERE owner_id=? AND id=?',[String(owner),id]);
    if(!rows.length)return null;
    const thread=decode(rows[0]);
    if(thread.courtSessions)delete thread.courtSessions[sessionId];
    return this.put(owner,{...thread,updatedAt:new Date().toISOString()},thread.revision);
  }
};
